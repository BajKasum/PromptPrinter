import { NextResponse } from "next/server";
import { z } from "@/shared/lib/zod";
import { problem } from "@/server/http/api-problem";
import { createClient } from "@/server/supabase/server";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { denied } from "@/server/security/security-log";
import { requestT } from "@/server/i18n";
import { endCliSession, listCliSessions } from "@/server/cli-login/sessions";
import { captureError } from "@/shared/lib/observability";

export const runtime = "nodejs";

// Die Terminals eines Kontos für die Einstellungen: ansehen (GET) und einzeln abmelden (DELETE ?id=). Nur mit dem Cookie,
// nie mit Bearer: ein Terminal soll weder die anderen sehen noch sie abmelden. Das Abmelden des eigenen Geräts läuft über
// api/cli/logout. Die Kennung des Kontos kommt aus der Sitzung, und die Funktion in der Datenbank beendet nur eine Sitzung
// dieses Kontos: eine fremde Kennung ergibt 404, wie eine schon beendete.

const LIST_LIMIT = { limit: 120, windowMs: 60 * 60 * 1000 };
const REVOKE_LIMIT = { limit: 60, windowMs: 60 * 60 * 1000 };

const sessionIdSchema = z.string().uuid();

export async function GET(req: Request) {
  const { t } = requestT(req);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return denied("cli-sessions", problem(401, t.api.signInRequired));

  const rl = await rateLimit(rateLimitKey(req, "cli-sessions", user.id), LIST_LIMIT);
  if (!rl.allowed) {
    return problem(429, t.api.tooManyRequests, { retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) });
  }

  try {
    return NextResponse.json({ sessions: await listCliSessions(user.id) }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    captureError("cli.sessions_list_failed", err, { userId: user.id });
    return problem(503, t.cliLogin.errors.unavailable, { kind: "unavailable" });
  }
}

export async function DELETE(req: Request) {
  const { t } = requestT(req);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return denied("cli-sessions", problem(401, t.api.signInRequired));

  const rl = await rateLimit(rateLimitKey(req, "cli-session-revoke", user.id), REVOKE_LIMIT);
  if (!rl.allowed) {
    return problem(429, t.api.tooManyRequests, { retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) });
  }

  const notFound = () =>
    denied("cli-sessions", problem(404, t.cliLogin.errors.sessionNotFound, { kind: "not_found" }), { userId: user.id });
  const parsed = sessionIdSchema.safeParse(new URL(req.url).searchParams.get("id"));
  if (!parsed.success) return notFound();

  try {
    if (!(await endCliSession(parsed.data, user.id, "settings"))) return notFound();
    return NextResponse.json({ ok: true });
  } catch (err) {
    captureError("cli.session_revoke_failed", err, { userId: user.id });
    return problem(503, t.cliLogin.errors.unavailable, { kind: "unavailable" });
  }
}
