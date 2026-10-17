import { NextResponse } from "next/server";
import { problem } from "@/server/http/api-problem";
import { createClient } from "@/server/supabase/server";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { setZaiConsent } from "@/server/consent";
import { requestT } from "@/server/i18n";
import { captureError } from "@/shared/lib/observability";

export const runtime = "nodejs";

/**
 * Die Zustimmung zur Übermittlung an Z.ai erteilen (POST) oder widerrufen
 * (DELETE). Siehe server/consent.ts für Grund und Grenzen.
 *
 * Nur mit Sitzung, die Kennung kommt aus der Sitzung und nie aus dem Körper:
 * niemand kann für ein anderes Konto zustimmen. Es gibt keinen Körper.
 */
const LIMIT = { limit: 20, windowMs: 60 * 60 * 1000 };

async function change(req: Request, granted: boolean): Promise<Response> {
  const m = requestT(req).t.api;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, m.signInRequired);

  const rl = await rateLimit(`consent:${rateLimitKey(req, user.id)}`, LIMIT);
  if (!rl.allowed) {
    return problem(429, m.tooManyRequests, {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  try {
    await setZaiConsent(user.id, granted);
  } catch (err) {
    captureError("consent.zai.failed", err, { granted });
    return problem(503, m.chatUnavailable);
  }
  return NextResponse.json({ ok: true, granted });
}

export const POST = (req: Request) => change(req, true);
export const DELETE = (req: Request) => change(req, false);
