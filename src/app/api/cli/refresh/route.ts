import { NextResponse } from "next/server";
import { z } from "@/shared/lib/zod";
import { problem } from "@/server/http/api-problem";
import { invalidJsonProblem, validationProblem } from "@/server/http/validation-problem";
import {
  MAX_SMALL_BODY_BYTES,
  RequestBodyTooLargeError,
  readJsonBody,
} from "@/server/http/request-body";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { requestT } from "@/server/i18n";
import { refreshCliSession } from "@/server/cli-login/session";
import { CLI_PROBLEMS } from "@/server/cli-login/messages";
import { captureError } from "@/shared/lib/observability";

export const runtime = "nodejs";

// Das Terminal tauscht sein Refresh-Token gegen ein frisches Access-Token (die Sitzung gilt eine Stunde,
// die Erneuerung läuft über diese Route statt direkt gegen Supabase: das Terminal kennt dessen Adresse
// und Schlüssel nicht). Das Refresh-Token IST der Nachweis, deshalb kein Cookie und kein Bearer; das
// Ratenlimit je Adresse bremst nur das Durchprobieren. Supabase dreht das Refresh-Token bei jeder
// Erneuerung: die Antwort enthält das neue, und das Terminal muss es speichern, bevor es weitermacht.
const RATE_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 };

const requestSchema = z.object({ refreshToken: z.string().min(1).max(512) });

export async function POST(req: Request) {
  const m = requestT(req).t.api;

  const rl = await rateLimit(rateLimitKey(req, "cli-refresh"), RATE_LIMIT);
  if (!rl.allowed) {
    return problem(429, m.tooManyRequests, {
      kind: "rate_limited",
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  let body: unknown;
  try {
    body = await readJsonBody(req, MAX_SMALL_BODY_BYTES);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) return problem(413, m.tooLarge);
    return invalidJsonProblem(m);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return validationProblem(m, parsed.error.issues);

  try {
    const session = await refreshCliSession(parsed.data.refreshToken);
    if (session === "invalid") return problem(401, CLI_PROBLEMS.invalidToken, { kind: "invalid_token" });
    if (!session) return problem(503, CLI_PROBLEMS.unavailable, { kind: "unavailable" });
    return NextResponse.json({ session }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    captureError("cli.refresh_failed", err);
    return problem(503, CLI_PROBLEMS.unavailable, { kind: "unavailable" });
  }
}
