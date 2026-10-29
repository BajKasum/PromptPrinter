import { NextResponse } from "next/server";
import { z } from "@/shared/lib/zod";
import { problem } from "@/server/http/api-problem";
import { invalidJsonProblem } from "@/server/http/validation-problem";
import {
  MAX_SMALL_BODY_BYTES,
  RequestBodyTooLargeError,
  readJsonBody,
} from "@/server/http/request-body";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { requestT } from "@/server/i18n";
import { DEVICE_CODE_PATTERN, MIN_POLL_GAP_MS, POLL_INTERVAL_SECONDS } from "@/server/cli-login/codes";
import { claimApprovedRequest, findRequestByDeviceCode, markPolled } from "@/server/cli-login/store";
import { issueCliSession } from "@/server/cli-login/session";
import { CLI_PROBLEMS } from "@/server/cli-login/messages";
import { captureError, logEvent } from "@/shared/lib/observability";

export const runtime = "nodejs";

// Schritt 3: das Terminal fragt mit seinem Geräte-Code nach. Anonym, der Geräte-Code (32 Byte Zufall)
// ist das Geheimnis. Antworten:
//   200 { status: "pending", interval }   noch nicht entschieden, nach `interval` Sekunden wieder fragen
//   200 { status: "approved", session }   freigegeben, ZUM EINZIGEN MAL: danach ist der Code verbraucht
//   400 invalid   Code unbekannt, falsch geformt oder schon abgeholt (nicht zu unterscheiden)
//   403 denied    im Browser abgelehnt
//   410 expired   die zehn Minuten sind um
//   429 slow_down das Terminal fragt schneller als `interval`
// Das Ratenlimit je Adresse (240 in zehn Minuten, bei fünf Sekunden Abstand reichen 120 für eine
// Anmeldung) bremst nur Missbrauch; die Abfragepause je Code steht in der Tabelle (last_polled_at).
const RATE_LIMIT = { limit: 240, windowMs: 10 * 60 * 1000 };

const requestSchema = z.object({ deviceCode: z.string().regex(DEVICE_CODE_PATTERN) });

export async function POST(req: Request) {
  const m = requestT(req).t.api;

  const rl = await rateLimit(rateLimitKey(req, "cli-token"), RATE_LIMIT);
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
  const invalid = () => problem(400, CLI_PROBLEMS.invalidCode, { kind: "invalid" });
  if (!parsed.success) return invalid();

  try {
    const request = await findRequestByDeviceCode(parsed.data.deviceCode);
    if (!request || request.status === "consumed") return invalid();

    if (new Date(request.expires_at).getTime() <= Date.now()) {
      return problem(410, CLI_PROBLEMS.expired, { kind: "expired" });
    }
    if (request.status === "denied") return problem(403, CLI_PROBLEMS.denied, { kind: "denied" });

    if (request.status === "pending") {
      const last = request.last_polled_at ? new Date(request.last_polled_at).getTime() : 0;
      if (Date.now() - last < MIN_POLL_GAP_MS) {
        return problem(429, CLI_PROBLEMS.slowDown, { kind: "slow_down", interval: POLL_INTERVAL_SECONDS });
      }
      await markPolled(request.id);
      return NextResponse.json(
        { status: "pending", interval: POLL_INTERVAL_SECONDS },
        { headers: { "cache-control": "no-store" } }
      );
    }

    // approved: genau ein Aufruf holt ab (ein Update, das nur approved trifft), jeder andere ist invalid.
    const userId = await claimApprovedRequest(request.id);
    if (!userId) return invalid();

    const session = await issueCliSession(userId);
    if (!session) {
      // Der Code ist verbraucht, die Anmeldung muss von vorn beginnen: lieber das als zweimal ausliefern.
      captureError("cli.session_issue_failed", new Error("issueCliSession returned null"), { userId });
      return problem(503, CLI_PROBLEMS.sessionFailed, { kind: "session_failed" });
    }
    logEvent("cli.session_issued", { userId });
    return NextResponse.json({ status: "approved", session }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    captureError("cli.token_failed", err);
    return problem(503, CLI_PROBLEMS.unavailable, { kind: "unavailable" });
  }
}
