import { NextResponse } from "next/server";
import { z } from "zod";
import { problem } from "@/server/http/api-problem";
import { createClient } from "@/server/supabase/server";
import { rateLimit, rateLimitKey, clientIp } from "@/server/security/rate-limit";
import { verifyTurnstileToken, MAX_TURNSTILE_TOKEN_CHARS } from "@/server/security/turnstile";
import {
  MAX_SMALL_BODY_BYTES,
  RequestBodyTooLargeError,
  readJsonBody,
} from "@/server/http/request-body";
import { translateAuthError } from "@/shared/lib/auth-errors";
import { siteUrl, safeNextPath } from "@/shared/lib/site-url";
import { MIN_PASSWORD_LENGTH } from "@/shared/lib/password";
import { logWarning } from "@/shared/lib/observability";

export const runtime = "nodejs";

/**
 * The four auth actions a signed-out visitor can trigger, behind one Turnstile
 * check.
 *
 * These used to run straight from the browser against Supabase, carrying the
 * Turnstile token as `captchaToken` — where nobody looked at it (the full story
 * is in lib/turnstile.ts). Verifying in the browser instead would have been
 * theatre: a client-side "check first, then call Supabase" is advice, not a
 * gate, since the caller decides whether to follow it. Moving the Supabase call
 * behind this route is what makes the check unavoidable, because the token and
 * the action it authorises are now redeemed in the same server request.
 *
 * One route with an `action` discriminant rather than four sibling routes, and
 * deliberately so: the captcha gate then exists in exactly ONE place, before
 * the switch. A fifth anonymous auth action added later cannot forget it.
 *
 * OAuth (oauth-buttons.tsx) stays client-side. It never had a captcha — the
 * flow leaves for Google/GitHub immediately and they run their own bot
 * defences — and routing a redirect handshake through here would buy nothing.
 */

// Bounds, not policy: Supabase remains the authority on what a valid
// credential is. The one exception is the signup minimum, which the signup
// FORM already enforces (MIN_PASSWORD_LENGTH, Security-Audit finding M-5) and
// which would otherwise be client-only now that the form no longer talks to
// Supabase itself.
const emailField = z.string().trim().email().max(254);
const passwordField = z.string().min(1).max(256);
const nextField = z.string().max(512).optional();
const tokenField = z.string().max(MAX_TURNSTILE_TOKEN_CHARS).optional();

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sign-in"),
    email: emailField,
    password: passwordField,
    turnstileToken: tokenField,
  }),
  z.object({
    action: z.literal("sign-up"),
    email: emailField,
    password: z.string().min(MIN_PASSWORD_LENGTH).max(256),
    next: nextField,
    turnstileToken: tokenField,
  }),
  z.object({
    action: z.literal("resend"),
    email: emailField,
    next: nextField,
    turnstileToken: tokenField,
  }),
  z.object({
    action: z.literal("reset-password"),
    email: emailField,
    turnstileToken: tokenField,
  }),
]);

/**
 * Anonymous by definition, so there is no session check to put first. The rate
 * limit takes that slot instead: it is the cheap gate that runs before the body
 * is read, keeping the ordering principle behind Security-Audit finding H-3
 * (never parse an unbounded payload for an unauthenticated caller) intact on a
 * route that has no user to authenticate.
 *
 * 30 per 10 minutes per IP covers a person mistyping a password, retrying, then
 * requesting a reset, with room for several people behind one NAT — while still
 * bounding credential stuffing from a single address well below what Supabase's
 * own per-IP auth limits would allow through.
 */
const RATE_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 };

export async function POST(req: Request) {
  const rl = await rateLimit(rateLimitKey(req), RATE_LIMIT);
  if (!rl.allowed) {
    return problem(429, "Zu viele Versuche, bitte warte kurz und versuch es erneut.", {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  let body: unknown;
  try {
    body = await readJsonBody(req, MAX_SMALL_BODY_BYTES);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) return problem(413, "Die Anfrage ist zu gross.");
    return problem(400, "Invalid JSON body");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return problem(400, "Invalid request", {
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const input = parsed.data;

  // ── The gate. Everything below this line is reached only by a redeemed token.
  const verdict = await verifyTurnstileToken(input.turnstileToken, clientIp(req));
  if (!verdict.ok) {
    // No email in the log line: this fires on ordinary human retries too (an
    // expired token, a resubmitted form), so it must not become a record of who
    // tried to sign in and when.
    logWarning("turnstile.rejected", { action: input.action, reason: verdict.reason });
    return problem(
      403,
      "Die Mensch-Prüfung ist fehlgeschlagen. Bitte lade die Seite neu und versuch es erneut.",
      { kind: "captcha" }
    );
  }

  const supabase = await createClient();

  // Supabase's own message, translated here rather than passed through raw
  // (Security-Audit finding M-1). These are 400s across the board on purpose:
  // the client only ever renders `detail`, and mapping GoTrue's mix of
  // credential, validation and throttling failures onto distinct statuses would
  // invent a contract nothing reads.
  const authFailure = (message: string) => problem(400, translateAuthError(message), { kind: "auth" });

  switch (input.action) {
    case "sign-in": {
      const { error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      if (error) return authFailure(error.message);
      // The session cookies were written by the server client on the way
      // through (lib/supabase/server.ts), so they ride out on this response.
      return NextResponse.json({ ok: true });
    }

    case "sign-up": {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: { emailRedirectTo: callbackUrl(input.next) },
      });
      if (error) return authFailure(error.message);
      // No session means email confirmation is switched on and the form has to
      // show its "check your inbox" state instead of celebrating.
      return NextResponse.json({ ok: true, session: Boolean(data.session) });
    }

    case "resend": {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: input.email,
        options: { emailRedirectTo: callbackUrl(input.next) },
      });
      if (error) return authFailure(error.message);
      return NextResponse.json({ ok: true });
    }

    case "reset-password": {
      const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
        redirectTo: siteUrl("/auth/callback?next=/reset-password/update"),
      });
      // Throttling is the one failure worth naming. Everything else answers
      // ok, preserving the form's existing promise never to reveal whether an
      // address is registered — an error here would leak exactly that.
      if (error && error.message.toLowerCase().includes("rate limit")) {
        return problem(429, "Zu viele Versuche, bitte kurz warten.");
      }
      return NextResponse.json({ ok: true });
    }
  }
}

/** Confirmation-mail landing spot. `next` is client-supplied, so it is
 * re-validated here — the browser is no longer the last word on it. */
function callbackUrl(next: string | undefined): string {
  const safe = safeNextPath(next ?? null);
  return siteUrl(`/auth/callback?next=${encodeURIComponent(safe)}`);
}
