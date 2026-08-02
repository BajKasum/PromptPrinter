/**
 * Cloudflare Turnstile verification, server side.
 *
 * The widget (components/auth/turnstile-widget.tsx) hands the browser a
 * single-use token. This module is the only place that redeems one, against
 * Cloudflare's canonical siteverify endpoint.
 *
 * Why this exists at all: until 2026-08-02 nothing verified these tokens.
 * The site key was configured, the widget rendered, the token travelled to
 * Supabase Auth as `captchaToken` — but Supabase only checks that value when
 * CAPTCHA protection is switched ON in its own dashboard, and it never was.
 * Verified against the live project rather than assumed: POST /auth/v1/recover
 * carrying the token "XXXX.DUMMY.TOKEN.XXXX" answered 200, which it cannot do
 * with the setting enabled. So the box asked people to prove they were human
 * and then threw the answer away — a captcha in appearance only. /api/auth now
 * runs the auth calls server-side behind this check instead of letting the
 * browser talk to Supabase directly, which is what makes the check a gate
 * rather than a suggestion the client could skip.
 *
 * ⚠️ Do NOT also enable Supabase's own CAPTCHA setting while this is in place.
 * A Turnstile token may be redeemed exactly once: whichever verifier got there
 * first would win and the second would see `timeout-or-duplicate`, breaking
 * every login. One verifier, and it is this one.
 */
import { captureError } from "@/lib/observability";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Cloudflare's own edge answers this in tens of milliseconds. The timeout is
 * a bound on how long a hung connection may hold an auth request open, not a
 * performance tuning knob — it fails closed (see below), so it is deliberately
 * generous enough that ordinary latency never trips it.
 */
const SITEVERIFY_TIMEOUT_MS = 10_000;

/**
 * Ceiling on a token we will forward. Cloudflare's are a few hundred to ~2000
 * characters; this just stops an oversized string from being relayed to
 * siteverify on our dime. The request body cap in the route is the real bound.
 */
export const MAX_TURNSTILE_TOKEN_CHARS = 4096;

/** True when a secret is configured, i.e. tokens will actually be redeemed. */
export function turnstileEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.TURNSTILE_SECRET?.trim());
}

export type TurnstileResult =
  /** `skipped` distinguishes "Cloudflare said yes" from "no secret configured". */
  | { ok: true; skipped: boolean }
  | { ok: false; reason: string };

/**
 * Redeems `token` at siteverify.
 *
 * Without TURNSTILE_SECRET this returns ok/skipped instead of refusing, which
 * keeps local dev and the test suite working with no Cloudflare setup — the
 * same bargain NEXT_PUBLIC_TURNSTILE_SITE_KEY already makes on the client
 * (unset = no widget). That is only safe because the two are coupled at boot:
 * env.ts refuses to start a PRODUCTION server that has the site key but not
 * the secret, which is exactly the "widget visible, nobody verifying" state
 * this module was written to end.
 *
 * Every other outcome fails CLOSED, including a siteverify that is unreachable
 * or answers something unparseable. The trade is explicit: a Cloudflare outage
 * blocks logins rather than waving through whatever arrives during it.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteip?: string | null
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET?.trim();
  if (!secret) return { ok: true, skipped: true };

  if (!token || token.length > MAX_TURNSTILE_TOKEN_CHARS) {
    return { ok: false, reason: "missing-input-response" };
  }

  const form = new URLSearchParams({ secret, response: token });
  // remoteip is optional. "unknown" is what clientIp() yields when no proxy
  // header was present at all — sending that literal string would be worse
  // than sending nothing.
  if (remoteip && remoteip !== "unknown") form.set("remoteip", remoteip);

  let payload: unknown;
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`siteverify answered HTTP ${res.status}`);
    payload = await res.json();
  } catch (err) {
    captureError("turnstile.siteverify_unreachable", err);
    return { ok: false, reason: "siteverify-unreachable" };
  }

  const data = (payload ?? {}) as { success?: unknown; "error-codes"?: unknown };
  const codes = Array.isArray(data["error-codes"]) ? data["error-codes"].map(String) : [];

  if (data.success === true) return { ok: true, skipped: false };

  // A wrong or unset secret is an operator problem, not a bot: it rejects
  // every real visitor identically and would otherwise read as "suddenly
  // everyone is a bot" in the logs.
  if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) {
    captureError(
      "turnstile.secret_rejected",
      new Error("siteverify refused TURNSTILE_SECRET — key wrong, or not the one for this sitekey"),
      { codes }
    );
  }

  return { ok: false, reason: codes.join(",") || "verification-failed" };
}
