import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { z } from "@/shared/lib/zod";
import { problem } from "@/server/http/api-problem";
import { invalidJsonProblem, validationProblem } from "@/server/http/validation-problem";
import {
  MAX_SMALL_BODY_BYTES,
  RequestBodyTooLargeError,
  readJsonBody,
} from "@/server/http/request-body";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { createAdminClient } from "@/server/supabase/admin";
import { hasVerifiedFactor, lacksSecondFactor } from "@/server/supabase/assurance";
import { signedInRecently } from "@/features/auth/lib/fresh-sign-in";
import { createClient } from "@/server/supabase/server";
import {
  countRecoveryCodes,
  deleteRecoveryCodes,
  redeemRecoveryCode,
  replaceRecoveryCodes,
} from "@/server/security/recovery-codes";
import { recordSecurityEvent } from "@/server/security/security-events";
import { denied, logSecurityEvent } from "@/server/security/security-log";
import { requestT } from "@/server/i18n";
import type { Messages } from "@/shared/i18n/messages/de";
import { captureError } from "@/shared/lib/observability";

export const runtime = "nodejs";

// Der zweite Faktor (TOTP über Supabase Auth): einrichten, nachweisen, ausschalten, und der Rückweg ohne Gerät. Alles auf dem Server
// statt im Browser, damit das Ratenlimit und das Protokoll nicht umgangen werden und die Wiederherstellungscodes nie im Browser
// entstehen. Die Sitzung schreibt der Server-Client in die Cookies, sie reisen mit dieser Antwort. Nur mit dem Cookie, nie mit Bearer:
// ein Terminal verwaltet keinen zweiten Faktor. Hinter der Herkunftsprüfung der Middleware.
//
// Supabase Auth begrenzt die Versuche nicht je Konto, sechs Ziffern sind schnell durchprobiert. Deshalb die enge Grenze: zehn Versuche
// in zehn Minuten, gezählt je Konto, auch für die Wiederherstellungscodes. Wer das Passwort kennt und den Code direkt bei Supabase
// probiert, trifft nur dessen Grenze je Adresse (docs/SETUP.md, "Zweiter Faktor").
const CODE_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 };
const ENROLL_LIMIT = { limit: 20, windowMs: 60 * 60 * 1000 };
const STATUS_LIMIT = { limit: 120, windowMs: 60 * 60 * 1000 };

const codeField = z.string().trim().regex(/^\d{6}$/);

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enroll") }),
  z.object({ action: z.literal("activate"), factorId: z.string().uuid(), code: codeField }),
  z.object({ action: z.literal("verify"), code: codeField }),
  z.object({ action: z.literal("recover"), recoveryCode: z.string().max(64) }),
  z.object({ action: z.literal("renew-codes"), code: codeField }),
  z.object({ action: z.literal("disable"), code: codeField }),
]);

type Client = Awaited<ReturnType<typeof createClient>>;
type MfaRequest = z.infer<typeof requestSchema>;
type Context = { supabase: Client; user: User; m: Messages["api"] };

const NO_STORE = { headers: { "cache-control": "no-store" } };

/** Der bestätigte TOTP-Faktor dieses Kontos. Mehr als einen legt die App nicht an. */
const totpFactorId = (user: User) =>
  user.factors?.find((factor) => factor.status === "verified" && factor.factor_type === "totp")?.id ?? null;

/** Prüft den Code: `"ok"` hebt die Sitzung auf AAL2, `"rejected"` ist ein falscher Code, `"failed"` ein Ausfall. */
async function checkCode(supabase: Client, factorId: string, code: string): Promise<"ok" | "rejected" | "failed"> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (!error) return "ok";
  const status = error.status ?? 0;
  return status >= 400 && status < 500 && status !== 429 ? "rejected" : "failed";
}

/** Prüft den Code eines bestätigten Faktors, oder gibt die Absage als Antwort zurück. */
async function requireCode({ supabase, user, m }: Context, code: string): Promise<{ factorId: string } | Response> {
  const factorId = totpFactorId(user);
  if (!factorId) return problem(400, m.mfaNotEnabled, { kind: "not_enabled" });
  const result = await checkCode(supabase, factorId, code);
  if (result === "ok") return { factorId };
  if (result === "rejected") {
    logSecurityEvent("mfa.verify_failed", { userId: user.id });
    return problem(400, m.mfaCodeInvalid, { kind: "invalid_code" });
  }
  captureError("mfa.verify_unavailable", new Error("challengeAndVerify failed"), { userId: user.id });
  return problem(503, m.mfaUnavailable, { kind: "unavailable" });
}

export async function GET(req: Request) {
  const m = requestT(req).t.api;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return denied("mfa", problem(401, m.signInRequired));

  const rl = await rateLimit(rateLimitKey(req, "mfa-status", user.id), STATUS_LIMIT);
  if (!rl.allowed) return problem(429, m.tooManyRequests, { retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) });

  const enabled = hasVerifiedFactor(user);
  const needsVerification = await lacksSecondFactor(supabase, user);
  let recoveryCodesLeft: number | null = null;
  if (enabled && !needsVerification) {
    try {
      recoveryCodesLeft = await countRecoveryCodes(user.id);
    } catch (err) {
      captureError("mfa.recovery_count_failed", err, { userId: user.id });
    }
  }
  return NextResponse.json({ enabled, needsVerification, recoveryCodesLeft }, NO_STORE);
}

export async function POST(req: Request) {
  const m = requestT(req).t.api;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return denied("mfa", problem(401, m.signInRequired));

  let body: unknown;
  try {
    body = await readJsonBody(req, MAX_SMALL_BODY_BYTES);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) return problem(413, m.tooLarge);
    return invalidJsonProblem(m);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return validationProblem(m, parsed.error.issues);
  const request = parsed.data;

  const limited =
    request.action === "enroll"
      ? await rateLimit(rateLimitKey(req, "mfa-enroll", user.id), ENROLL_LIMIT)
      : await rateLimit(rateLimitKey(req, "mfa-code", user.id), CODE_LIMIT);
  if (!limited.allowed) {
    return problem(429, m.tooManyRequests, { retryAfter: Math.ceil((limited.resetAt - Date.now()) / 1000) });
  }

  try {
    return await run(request, { supabase, user, m });
  } catch (err) {
    captureError("mfa.action_failed", err, { userId: user.id, action: request.action });
    return problem(503, m.mfaUnavailable, { kind: "unavailable" });
  }
}

function run(request: MfaRequest, context: Context): Promise<Response> {
  switch (request.action) {
    case "enroll":
      return enroll(context);
    case "activate":
      return activate(context, request.factorId, request.code);
    case "verify":
      return verify(context, request.code);
    case "recover":
      return recover(context, request.recoveryCode);
    case "renew-codes":
      return renewCodes(context, request.code);
    case "disable":
      return disable(context, request.code);
  }
}

async function enroll({ supabase, user, m }: Context): Promise<Response> {
  if (hasVerifiedFactor(user)) return problem(400, m.mfaAlreadyEnabled, { kind: "already_enabled" });

  // Nur nach einer frischen Anmeldung: wer ein Sitzungs-Cookie stiehlt, soll dem Besitzer keinen eigenen Faktor unterschieben und ihn
  // damit aussperren. Bestätigen kann ein Fremder den Code seiner eigenen App ja jederzeit.
  const { data: claims } = await supabase.auth.getClaims();
  if (!signedInRecently(claims?.claims.amr)) {
    return denied("mfa", problem(403, m.mfaReauthRequired, { code: "reauth_required" }), { userId: user.id });
  }

  // Ein abgebrochener Versuch hinterlässt einen unbestätigten Faktor, und zwei mit demselben Namen lehnt Supabase Auth ab.
  for (const factor of user.factors ?? []) {
    if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "PromptPrinter",
    friendlyName: "PromptPrinter",
  });
  if (error || data.type !== "totp") {
    captureError("mfa.enroll_failed", error ?? new Error("unexpected factor type"), { userId: user.id });
    return problem(503, m.mfaUnavailable, { kind: "unavailable" });
  }
  return NextResponse.json({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }, NO_STORE);
}

async function activate({ supabase, user, m }: Context, factorId: string, code: string): Promise<Response> {
  const result = await checkCode(supabase, factorId, code);
  if (result === "rejected") return problem(400, m.mfaCodeInvalid, { kind: "invalid_code" });
  if (result === "failed") {
    captureError("mfa.activate_unavailable", new Error("challengeAndVerify failed"), { userId: user.id });
    return problem(503, m.mfaUnavailable, { kind: "unavailable" });
  }
  await recordSecurityEvent("mfa.enabled", user.id);

  // Der Faktor ist jetzt aktiv. Scheitern nur die Codes, lassen sie sich in den Einstellungen neu erzeugen: der Nutzer erfährt es.
  try {
    return NextResponse.json({ recoveryCodes: await replaceRecoveryCodes(user.id) }, NO_STORE);
  } catch (err) {
    captureError("mfa.recovery_codes_failed", err, { userId: user.id });
    return NextResponse.json({ recoveryCodes: null }, NO_STORE);
  }
}

async function verify(context: Context, code: string): Promise<Response> {
  const checked = await requireCode(context, code);
  if (checked instanceof Response) return checked;
  logSecurityEvent("mfa.verified", { userId: context.user.id });
  return NextResponse.json({ ok: true });
}

/**
 * Der Rückweg ohne Gerät: ein Wiederherstellungscode schaltet den zweiten Faktor aus, danach richtet ihn der Nutzer neu ein. Verlangt
 * eine Sitzung, also das Passwort oder den OAuth-Anbieter: der Code ersetzt das Gerät, nicht die Anmeldung. Scheitert das Entfernen
 * nach dem Einlösen, ist dieser eine Code verbraucht, die übrigen gelten weiter.
 */
async function recover({ user, m }: Context, recoveryCode: string): Promise<Response> {
  if (!hasVerifiedFactor(user)) return problem(400, m.mfaNotEnabled, { kind: "not_enabled" });
  if (!(await redeemRecoveryCode(user.id, recoveryCode))) {
    logSecurityEvent("mfa.recovery_failed", { userId: user.id });
    return problem(400, m.mfaRecoveryInvalid, { kind: "invalid_recovery_code" });
  }

  const admin = createAdminClient();
  for (const factor of user.factors ?? []) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.id });
    if (error) throw error;
  }
  await deleteRecoveryCodes(user.id);
  await recordSecurityEvent("mfa.recovery_used", user.id);
  return NextResponse.json({ ok: true });
}

async function renewCodes(context: Context, code: string): Promise<Response> {
  const checked = await requireCode(context, code);
  if (checked instanceof Response) return checked;
  const recoveryCodes = await replaceRecoveryCodes(context.user.id);
  await recordSecurityEvent("mfa.recovery_codes_renewed", context.user.id);
  return NextResponse.json({ recoveryCodes }, NO_STORE);
}

// Ausschalten verlangt den Code, nicht nur eine AAL2-Sitzung: das Sitzungs-Cookie ist für Skripte lesbar, und wer es stiehlt, soll den
// Schutz nicht abschalten können. Wer das Gerät nicht mehr hat, nimmt den Rückweg oben.
async function disable(context: Context, code: string): Promise<Response> {
  const { supabase, user, m } = context;
  const checked = await requireCode(context, code);
  if (checked instanceof Response) return checked;

  const { error } = await supabase.auth.mfa.unenroll({ factorId: checked.factorId });
  if (error) {
    captureError("mfa.disable_failed", error, { userId: user.id });
    return problem(503, m.mfaUnavailable, { kind: "unavailable" });
  }
  await deleteRecoveryCodes(user.id);
  await recordSecurityEvent("mfa.disabled", user.id);
  return NextResponse.json({ ok: true });
}
