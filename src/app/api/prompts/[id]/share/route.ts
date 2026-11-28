import { NextResponse } from "next/server";
import { z } from "@/shared/lib/zod";
import { createClient } from "@/server/supabase/server";
import { problem, rateLimitedProblem } from "@/server/http/api-problem";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { denied } from "@/server/security/security-log";
import { recordSecurityEvent } from "@/server/security/security-events";
import { createShare, revokeShare, shareTokenFor } from "@/server/prompt-share";
import { requestT } from "@/server/i18n";
import { captureError } from "@/shared/lib/observability";
import type { Messages } from "@/shared/i18n/messages/de";

type ShareMessages = Messages["share"];

export const runtime = "nodejs";

// Teilen eines gespeicherten Prompts per Link (Migration 0057, server/prompt-share.ts).
//   GET     ist er geteilt? { token | null }
//   POST    teilen, liefert { token } (dasselbe, wenn er schon geteilt ist)
//   DELETE  widerrufen
// Die Sitzung kommt aus dem Cookie, die Kennung des Prompts aus der Adresse; ob der Prompt dem Konto gehört, prüft die
// Route mit dem Client der Person (RLS) und zusätzlich mit user_id, bevor die Service-Role schreibt. Im Protokoll heisst
// die Kennung `savedId`: ein Schlüssel mit dem Wort "prompt" würde geschwärzt (shared/lib/observability.ts).

const idSchema = z.string().uuid();

// Je Methode ein eigener Topf: das Nachsehen beim Aufklappen jedes Prompts darf weder das Teilen noch das Widerrufen
// aufbrauchen. Widerrufen bekommt einen eigenen, damit ein Link immer zurückzunehmen ist.
const WINDOW_MS = 60 * 60 * 1000;
type Limit = (req: Request, userId: string) => ReturnType<typeof rateLimit>;
const LIMITS: Record<"GET" | "POST" | "DELETE", Limit> = {
  GET: (req, userId) => rateLimit(rateLimitKey(req, "prompt-share-read", userId), { limit: 300, windowMs: WINDOW_MS }),
  POST: (req, userId) => rateLimit(rateLimitKey(req, "prompt-share", userId), { limit: 60, windowMs: WINDOW_MS }),
  DELETE: (req, userId) => rateLimit(rateLimitKey(req, "prompt-share-revoke", userId), { limit: 60, windowMs: WINDOW_MS }),
};

type Context = { params: Promise<{ id: string }> };

async function authorize(
  req: Request,
  ctx: Context,
  method: keyof typeof LIMITS,
  m: ShareMessages & { signInRequired: string; tooManyRequests: string }
): Promise<{ userId: string; promptId: string } | Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return denied("prompt-share", problem(401, m.signInRequired));

  const parsed = idSchema.safeParse((await ctx.params).id);
  if (!parsed.success) return denied("prompt-share", problem(404, m.notFound), { userId: user.id });
  const promptId = parsed.data;

  const rl = await LIMITS[method](req, user.id);
  if (!rl.allowed) return rateLimitedProblem(m.tooManyRequests, rl);

  const { data, error } = await supabase
    .from("saved_prompts")
    .select("id")
    .eq("id", promptId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    captureError("prompt_share.owner_read_failed", error, { userId: user.id });
    return problem(503, m.failed);
  }
  if (!data) return denied("prompt-share", problem(404, m.notFound), { userId: user.id });
  return { userId: user.id, promptId };
}

export async function GET(req: Request, ctx: Context) {
  const { t } = requestT(req);
  const m = { ...t.share, signInRequired: t.api.signInRequired, tooManyRequests: t.api.tooManyRequests };
  const auth = await authorize(req, ctx, "GET", m);
  if (auth instanceof Response) return auth;
  try {
    return NextResponse.json({ token: await shareTokenFor(auth.userId, auth.promptId) });
  } catch (err) {
    captureError("prompt_share.read_failed", err, { userId: auth.userId });
    return problem(503, m.failed);
  }
}

export async function POST(req: Request, ctx: Context) {
  const { t } = requestT(req);
  const m = { ...t.share, signInRequired: t.api.signInRequired, tooManyRequests: t.api.tooManyRequests };
  const auth = await authorize(req, ctx, "POST", m);
  if (auth instanceof Response) return auth;
  let share: { token: string; created: boolean };
  try {
    share = await createShare(auth.userId, auth.promptId);
  } catch (err) {
    captureError("prompt_share.create_failed", err, { userId: auth.userId });
    return problem(503, m.failed);
  }
  if (share.created) await recordSecurityEvent("prompt.shared", auth.userId, { savedId: auth.promptId });
  return NextResponse.json({ token: share.token });
}

export async function DELETE(req: Request, ctx: Context) {
  const { t } = requestT(req);
  const m = { ...t.share, signInRequired: t.api.signInRequired, tooManyRequests: t.api.tooManyRequests };
  const auth = await authorize(req, ctx, "DELETE", m);
  if (auth instanceof Response) return auth;
  let revoked: boolean;
  try {
    revoked = await revokeShare(auth.userId, auth.promptId);
  } catch (err) {
    captureError("prompt_share.revoke_failed", err, { userId: auth.userId });
    return problem(503, m.failed);
  }
  if (revoked) await recordSecurityEvent("prompt.unshared", auth.userId, { savedId: auth.promptId });
  return NextResponse.json({ token: null });
}
