import { NextResponse } from "next/server";
import { z } from "@/shared/lib/zod";
import { createClient } from "@/server/supabase/server";
import { problem } from "@/server/http/api-problem";
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
// Route mit dem Client der Person (RLS) und zusätzlich mit user_id, bevor die Service-Role schreibt.

const idSchema = z.string().uuid();

type Context = { params: Promise<{ id: string }> };

async function authorize(
  req: Request,
  ctx: Context,
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

  const rl = await rateLimit(rateLimitKey(req, "prompt-share", user.id), { limit: 60, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return problem(429, m.tooManyRequests, { retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) });
  }

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
  const auth = await authorize(req, ctx, m);
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
  const auth = await authorize(req, ctx, m);
  if (auth instanceof Response) return auth;
  let share: { token: string; created: boolean };
  try {
    share = await createShare(auth.userId, auth.promptId);
  } catch (err) {
    captureError("prompt_share.create_failed", err, { userId: auth.userId });
    return problem(503, m.failed);
  }
  if (share.created) await recordSecurityEvent("prompt.shared", auth.userId, { promptId: auth.promptId });
  return NextResponse.json({ token: share.token });
}

export async function DELETE(req: Request, ctx: Context) {
  const { t } = requestT(req);
  const m = { ...t.share, signInRequired: t.api.signInRequired, tooManyRequests: t.api.tooManyRequests };
  const auth = await authorize(req, ctx, m);
  if (auth instanceof Response) return auth;
  let revoked: boolean;
  try {
    revoked = await revokeShare(auth.userId, auth.promptId);
  } catch (err) {
    captureError("prompt_share.revoke_failed", err, { userId: auth.userId });
    return problem(503, m.failed);
  }
  if (revoked) await recordSecurityEvent("prompt.unshared", auth.userId, { promptId: auth.promptId });
  return NextResponse.json({ token: null });
}
