import { NextResponse } from "next/server";
import { z } from "@/shared/lib/zod";
import { problem } from "@/server/http/api-problem";
import { invalidJsonProblem, validationProblem } from "@/server/http/validation-problem";
import {
  MAX_SMALL_BODY_BYTES,
  RequestBodyTooLargeError,
  readJsonBody,
} from "@/server/http/request-body";
import { isSameOrigin } from "@/server/http/same-origin";
import { createClient } from "@/server/supabase/server";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { requestT } from "@/server/i18n";
import { decideRequest, findPendingRequest } from "@/server/cli-login/store";
import { normalizeUserCode } from "@/shared/lib/cli-user-code";
import { captureError, logEvent } from "@/shared/lib/observability";

export const runtime = "nodejs";

// Schritt 2 der Anmeldung per Geräte-Code: der Mensch bestätigt im Browser, eingeloggt, den Code seines
// Terminals. Drei Aktionen auf einer Route: `lookup` zeigt, WAS bestätigt würde (Gerätename, Uhrzeit),
// `approve` und `deny` entscheiden.
//
// Bewusst nur mit dem Cookie, nie mit Bearer (createClient, ohne den Bearer-Weg des Chats): ein Terminal,
// das schon angemeldet ist, darf mit seinem Token kein weiteres Gerät freigeben. Weil ein Cookie-POST
// von jeder Seite ausgelöst werden kann, kommt vor allem anderen die Origin-Prüfung (zweite Linie neben
// sameSite=lax). Das Ratenlimit je Nutzer (10 in der Minute) hält das Durchprobieren von Nutzer-Codes
// (rund 38 Bit) bei zehn Minuten Gültigkeit weit unter jeder Trefferchance; es zählt jede Anfrage,
// auch ein Fehlversuch und die Vorschau.
const RATE_LIMIT = { limit: 10, windowMs: 60 * 1000 };

const requestSchema = z.object({
  userCode: z.string().max(32),
  action: z.enum(["lookup", "approve", "deny"]),
});

export async function POST(req: Request) {
  const { t } = requestT(req);
  const m = t.api;
  const c = t.cliLogin;

  if (!isSameOrigin(req)) return problem(403, c.errors.foreignOrigin, { kind: "origin" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, m.signInRequired);

  const rl = await rateLimit(rateLimitKey(req, "cli-approve", user.id), RATE_LIMIT);
  if (!rl.allowed) {
    return problem(429, m.tooManyRequests, {
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

  // Falsche Form, unbekannter, abgelaufener und schon entschiedener Code geben dieselbe Antwort: wer
  // Codes durchprobiert, erfährt nichts über den Zustand einer fremden Anfrage.
  const notFound = () => problem(404, c.errors.notFound, { kind: "not_found" });
  const userCode = normalizeUserCode(parsed.data.userCode);
  if (!userCode) return notFound();

  try {
    if (parsed.data.action === "lookup") {
      const pending = await findPendingRequest(userCode);
      return pending ? NextResponse.json(pending) : notFound();
    }

    const decision = parsed.data.action === "approve" ? "approved" : "denied";
    if (!(await decideRequest(userCode, user.id, decision))) return notFound();
    logEvent(`cli.login_${decision}`, { userId: user.id });
    return NextResponse.json({ ok: true, status: decision });
  } catch (err) {
    captureError("cli.approve_failed", err, { userId: user.id });
    return problem(503, c.errors.unavailable, { kind: "unavailable" });
  }
}
