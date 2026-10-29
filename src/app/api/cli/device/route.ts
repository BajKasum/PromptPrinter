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
import { cleanClientName, DEVICE_REQUEST_TTL_MS, POLL_INTERVAL_SECONDS } from "@/server/cli-login/codes";
import { createDeviceRequest } from "@/server/cli-login/store";
import { CLI_PROBLEMS } from "@/server/cli-login/messages";
import { formatUserCode } from "@/shared/lib/cli-user-code";
import { siteUrl } from "@/shared/lib/site-url";
import { captureError, logEvent } from "@/shared/lib/observability";

export const runtime = "nodejs";

// Schritt 1 der Anmeldung per Geräte-Code: das Terminal bittet um einen Code. Anonym, denn es hat noch
// nichts; deshalb das Ratenlimit je Adresse vor allem anderen, auch vor dem Lesen des Bodys. 20 in zehn
// Minuten sind weit mehr, als ein Mensch Anmeldungen startet, und halten die Tabelle klein.
//
// Der Geräte-Code geht nur an das Terminal zurück (und wird nur als Hash gespeichert), der Nutzer-Code
// ist für den Menschen. Die Adresse der Bestätigungsseite trägt KEINEN Code: ein vorausgefüllter Link
// würde jedem helfen, dem Nutzer den Code eines fremden Geräts unterzuschieben.
const RATE_LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 };

// Der Name ist ein Vorschlag des Terminals; gekürzt und bereinigt wird danach (cleanClientName).
const requestSchema = z.object({ clientName: z.string().max(200).optional() });

export async function POST(req: Request) {
  const { t } = requestT(req);
  const m = t.api;

  const rl = await rateLimit(rateLimitKey(req, "cli-device"), RATE_LIMIT);
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
    const created = await createDeviceRequest(cleanClientName(parsed.data.clientName));
    logEvent("cli.device_requested", {});
    return NextResponse.json(
      {
        deviceCode: created.deviceCode,
        userCode: formatUserCode(created.userCode),
        verificationUri: siteUrl("/cli"),
        expiresIn: DEVICE_REQUEST_TTL_MS / 1000,
        interval: POLL_INTERVAL_SECONDS,
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    captureError("cli.device_request_failed", err);
    return problem(503, CLI_PROBLEMS.unavailable, { kind: "unavailable" });
  }
}
