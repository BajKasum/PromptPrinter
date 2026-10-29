import { NextResponse } from "next/server";
import { problem } from "@/server/http/api-problem";
import { bearerToken } from "@/server/supabase/bearer";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { requestT } from "@/server/i18n";
import { revokeCliSession } from "@/server/cli-login/session";
import { CLI_PROBLEMS } from "@/server/cli-login/messages";
import { captureError, logEvent } from "@/shared/lib/observability";

export const runtime = "nodejs";

// Das Terminal meldet sich ab: beendet genau die Sitzung, deren Access-Token im Kopf steht (scope local).
// Die Browser-Sitzung und andere Geräte bleiben. Das Token wird vorher beim Auth-Server geprüft, nicht
// nur gelesen (revokeCliSession). Ohne Body: das Token im Kopf ist die ganze Anfrage. Das Ratenlimit
// je Adresse bremst nur Missbrauch.
const RATE_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 };

export async function POST(req: Request) {
  const m = requestT(req).t.api;

  const rl = await rateLimit(rateLimitKey(req, "cli-logout"), RATE_LIMIT);
  if (!rl.allowed) {
    return problem(429, m.tooManyRequests, {
      kind: "rate_limited",
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  const token = bearerToken(req);
  if (!token) return problem(401, CLI_PROBLEMS.unauthorized, { kind: "unauthorized" });

  try {
    const result = await revokeCliSession(token);
    if (result === "unauthorized") return problem(401, CLI_PROBLEMS.unauthorized, { kind: "unauthorized" });
    if (result === null) return problem(503, CLI_PROBLEMS.unavailable, { kind: "unavailable" });
    logEvent("cli.logout", {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    captureError("cli.logout_failed", err);
    return problem(503, CLI_PROBLEMS.unavailable, { kind: "unavailable" });
  }
}
