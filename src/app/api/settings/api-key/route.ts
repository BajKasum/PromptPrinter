import { NextResponse } from "next/server";
import { z } from "@/shared/lib/zod";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { createClient } from "@/server/supabase/server";
import { lacksSecondFactor } from "@/server/supabase/assurance";
import { chatComplete, type LlmOverride } from "@/server/llm";
import {
  activateByokProvider,
  byokRow,
  removeByokRow,
  saveByokRow,
  type ByokRow,
  type ByokTarget,
} from "@/server/byok";
import { problem, rateLimitedProblem } from "@/server/http/api-problem";
import { validationProblem } from "@/server/http/validation-problem";
import { readBody } from "@/server/http/validated-body";
import { captureError } from "@/shared/lib/observability";
import { recordSecurityEvent } from "@/server/security/security-events";
import { denied } from "@/server/security/security-log";
import { detectProviderFromKey } from "@/shared/lib/byok-detect";
import { requestT } from "@/server/i18n";
import { fmt } from "@/shared/i18n/format";
import type { Messages } from "@/shared/i18n/messages/de";

export const runtime = "nodejs";

// Einstellungen → "Eigene API-Keys" (BYOK): den eigenen Key von Anthropic, OpenAI oder Gemini speichern, umschalten und
// entfernen, dazu jeden OpenAI-kompatiblen Endpunkt ('custom', etwa Z.ai, DeepSeek, Groq oder OpenRouter). Die Chats
// laufen dann auf dem eigenen Konto statt auf dem Server-Key (LlmOverride, server/llm/types.ts). Vor dem Verschlüsseln
// und Speichern geht ein Testaufruf an den Anbieter: ein Tippfehler oder ein widerrufener Key scheitert hier mit einer
// klaren Meldung, nicht still beim nächsten Chat-Zug.

const NAMED_PROVIDERS = ["anthropic", "openai", "gemini"] as const;
const PROVIDERS = [...NAMED_PROVIDERS, "custom"] as const;

// Die Oberfläche hat nur ein Feld, kein Anbieter-Menü. Der Primärzweig trägt deshalb bewusst KEIN `provider`: welcher
// der drei benannten Anbieter gemeint ist, leitet der Server unten aus dem Key selbst ab (detectProviderFromKey), nie
// aus einer Angabe des Browsers. `.strict()` ist hier kein Stilmittel: ohne sie verwürfe Zod ein mitgeschicktes
// `provider: "custom"` (samt label, baseUrl und model) stillschweigend und liesse die Anfrage in DIESEM Zweig gelten,
// bevor der custom-Zweig geprüft ist. Jede fehlerhafte custom-Eingabe liefe dann unbemerkt in den falschen Pfad.
const primarySaveSchema = z
  .object({ apiKey: z.string().trim().min(1, "Key darf nicht leer sein").max(300) })
  .strict();
const customSaveSchema = z.object({
  provider: z.literal("custom"),
  apiKey: z.string().trim().min(1, "Key darf nicht leer sein").max(300),
  label: z.string().trim().min(1, "Name darf nicht leer sein").max(60),
  baseUrl: z.string().trim().url("Muss eine gültige URL sein").max(300),
  model: z.string().trim().min(1, "Modell darf nicht leer sein").max(100),
});
const saveSchema = z.union([primarySaveSchema, customSaveSchema]);

// Gelesen wird mit der Sitzung, geschrieben nur über server/byok.ts mit dem Service-Role-Schlüssel (Migration 0060).
const activateSchema = z.object({ provider: z.enum(PROVIDERS) });

const HOUR_MS = 60 * 60 * 1000;

// Je Methode ein eigenes Stundenlimit (jeder Bereich als Literal, tests/guards/rate-limit-scopes.test.ts) und der Satz,
// wenn sich dafür das Profil nicht lesen lässt. Speichern ist enger: es ruft den Anbieter auf, um den Key zu prüfen.
const KEY_LIMITS = {
  POST: {
    check: (req: Request, userId: string) =>
      rateLimit(rateLimitKey(req, "api-key-save", userId), { limit: 30, windowMs: HOUR_MS }),
    failed: "keySaveFailed",
  },
  PATCH: {
    check: (req: Request, userId: string) =>
      rateLimit(rateLimitKey(req, "api-key-update", userId), { limit: 60, windowMs: HOUR_MS }),
    failed: "keyActivateFailed",
  },
  DELETE: {
    check: (req: Request, userId: string) =>
      rateLimit(rateLimitKey(req, "api-key-delete", userId), { limit: 60, windowMs: HOUR_MS }),
    failed: "keyRemoveFailed",
  },
} as const;

export async function POST(req: Request) {
  // Die Sprache der Fehlermeldungen: die der App (Cookie pp-locale).
  const m = requestT(req).t.api;
  // Erst der Aufrufer, dann der Rumpf: er trägt den Key im Klartext, und ohne Anmeldung liest die Route ihn nicht.
  const owner = await requireKeyOwner(m);
  if (owner instanceof Response) return owner;
  const { supabase, user } = owner;

  const request = await readSaveRequest(req, m);
  if (request instanceof Response) return request;
  const { apiKey, resolved } = request;
  const provider = resolved.provider;

  const limited = await enforceKeyLimit(req, owner, "POST", m);
  if (limited) return limited;

  const override: LlmOverride =
    resolved.provider === "custom"
      ? { provider: resolved.provider, apiKey, baseUrl: resolved.baseUrl, model: resolved.model }
      : { provider: resolved.provider, apiKey };

  const unverified = await verifyKey(override, m);
  if (unverified) return unverified;

  let row: ByokRow;
  try {
    row = byokRow(user.id, apiKey, resolved);
  } catch (err) {
    // Ohne API_KEY_ENCRYPTION_SECRET: in Produktion verhindert das der Start (env.ts), lokal fehlt der Wert oft.
    captureError("api_key.encrypt_failed", err, { userId: user.id, provider });
    return problem(500, m.keySaveFailed);
  }

  // Neu oder ersetzt: das Protokoll soll beides unterscheiden können. Ein Lesefehler hält das Speichern nicht auf.
  const { data: before, error: beforeError } = await supabase
    .from("user_api_keys")
    .select("provider")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .maybeSingle();

  const { error } = await saveByokRow(row);
  if (error) {
    // Allgemein an den Browser, ausführlich ins Log. Anders als beim Testaufruf oben spricht hier die eigene Datenbank:
    // ihre Meldung nennt Spalten und Beschränkungen, damit kann der Nutzer nichts anfangen, ein Angreifer schon.
    captureError("api_key.save_failed", error, { userId: user.id, provider });
    return problem(500, m.keySaveFailed);
  }
  await recordSecurityEvent("api_key.saved", user.id, { provider, replaced: beforeError ? null : Boolean(before) });

  // Der erste Key muss der aktive werden, sonst läge er gespeichert und ungenutzt da. Spätere nehmen den Platz nicht:
  // umschalten entscheidet der Nutzer (PATCH unten), ein zweiter Anbieter ändert also nie still, wessen Key zahlt.
  const { data: active, error: activeError } = await supabase
    .from("user_api_keys")
    .select("provider")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  // Ein Lesefehler ist nicht "noch kein aktiver Key": sonst nähme dieser Key einem anderen den Platz weg. Das Speichern
  // oben ist ein upsert, ein zweiter Versuch ist also unschädlich. Gespeichert ist der Key aber schon: die Meldung sagt
  // deshalb, dass das Aktivieren offen ist, nicht dass das Speichern scheiterte.
  if (activeError) {
    captureError("api_key.active_read_failed", activeError, { userId: user.id, provider });
    return problem(503, m.keyActivateFailed);
  }
  if (!active) {
    const { error: activateError } = await activateByokProvider(user.id, provider);
    if (activateError) {
      captureError("api_key.activate_failed", activateError, { userId: user.id, provider });
    } else {
      await recordSecurityEvent("api_key.activated", user.id, { provider, automatic: true });
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * Legt fest, welcher gespeicherte Key die Chats dieses Kontos ausführt.
 *
 * Über die Funktion set_active_byok_provider_for statt zweier Updates: das alte Häkchen löschen und das neue setzen muss
 * eine Anweisung sein. Sonst bliebe nach einem halben Fehlschlag kein aktiver Key (still zurück auf den Server-Anbieter
 * und seine Grenzen) oder zwei, was der Teil-Index ablehnt.
 */
export async function PATCH(req: Request) {
  // Die Sprache der Fehlermeldungen: die der App (Cookie pp-locale).
  const m = requestT(req).t.api;
  const owner = await requireKeyOwner(m);
  if (owner instanceof Response) return owner;
  const { supabase, user } = owner;

  const limited = await enforceKeyLimit(req, owner, "PATCH", m);
  if (limited) return limited;

  const read = await readBody(req, m);
  if (read instanceof Response) return read;
  const parsed = activateSchema.safeParse(read.body);
  if (!parsed.success) return problem(400, m.keyUnknownProviderShort);
  const { provider } = parsed.data;

  // Aktiviert wird nur ein gespeicherter Anbieter. Sonst setzte die Funktion jede Zeile auf is_active = false (nichts
  // passt) und das Konto fiele still auf den Server-Key zurück.
  const { data: existing, error: existingError } = await supabase
    .from("user_api_keys")
    .select("provider")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .maybeSingle();
  if (existingError) {
    captureError("api_key.existing_read_failed", existingError, { userId: user.id, provider });
    return problem(503, m.keyActivateFailed);
  }
  if (!existing) return denied("api_key", problem(404, m.keyNotFound), { userId: user.id, provider });

  const { error } = await activateByokProvider(user.id, provider);
  if (error) {
    captureError("api_key.activate_failed", error, { userId: user.id, provider });
    return problem(500, m.keyActivateFailed);
  }
  await recordSecurityEvent("api_key.activated", user.id, { provider, automatic: false });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  // Die Sprache der Fehlermeldungen: die der App (Cookie pp-locale).
  const m = requestT(req).t.api;
  const provider = new URL(req.url).searchParams.get("provider");
  if (!provider || !PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) {
    return problem(400, m.keyUnknownProviderShort);
  }

  const owner = await requireKeyOwner(m);
  if (owner instanceof Response) return owner;
  const { user } = owner;

  const limited = await enforceKeyLimit(req, owner, "DELETE", m);
  if (limited) return limited;

  const { error, removed } = await removeByokRow(user.id, provider);
  if (error) {
    captureError("api_key.delete_failed", error, { userId: user.id, provider });
    return problem(500, m.keyRemoveFailed);
  }
  if (removed) await recordSecurityEvent("api_key.removed", user.id, { provider });

  return NextResponse.json({ ok: true });
}

async function readSaveRequest(req: Request, m: Messages["api"]): Promise<{ apiKey: string; resolved: ByokTarget } | Response> {
  const read = await readBody(req, m);
  if (read instanceof Response) return read;
  const { body } = read;

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    // `issues` meldet den ersten weichen Zweig der Vereinigung, bei einem custom-Rumpf also den
    // primären ("unbekannte Schlüssel"). Dem Nutzer sagen wir, was in SEINEM Zweig nicht stimmt.
    const isCustom = typeof body === "object" && body !== null && "provider" in body && body.provider === "custom";
    const own = (isCustom ? customSaveSchema : primarySaveSchema).safeParse(body);
    return validationProblem(m, parsed.error.issues, own.success ? undefined : own.error.issues);
  }

  // Der Anbieter kommt entweder mit (custom-Zweig: eigene Endpunkt-Angaben lassen sich nicht erraten) oder folgt aus
  // dem Format des Keys. `resolved` hält provider und, nur bei custom, label, baseUrl und model als EIN unterscheidbares
  // Objekt zusammen: so verengt `resolved.provider === "custom"` weiter oben ohne `!` und ohne zweite Variable.
  const apiKey = parsed.data.apiKey;
  const resolved: ByokTarget | null = "provider" in parsed.data
    ? {
        provider: parsed.data.provider,
        label: parsed.data.label,
        baseUrl: parsed.data.baseUrl,
        model: parsed.data.model,
      }
    : (() => {
        const detected = detectProviderFromKey(apiKey);
        return detected ? { provider: detected } : null;
      })();
  if (!resolved) {
    return problem(
      400,
      m.keyUnknownProvider,
      { kind: "unknownProvider" }
    );
  }
  return { apiKey, resolved };
}

/**
 * Wer Keys speichern, umschalten und entfernen darf: angemeldet und, mit eingerichtetem zweitem Faktor, mit dessen
 * Nachweis (AAL2). Jede Methode dieser Route fängt hiermit an (tests/guards/second-factor.test.ts).
 */
async function requireKeyOwner(m: Messages["api"]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return denied("api_key", problem(401, m.signInRequired));
  if (await lacksSecondFactor(supabase, user)) {
    return denied("api_key", problem(403, m.secondFactorRequired, { code: "aal2_required" }), { userId: user.id });
  }
  return { supabase, user };
}

type KeyOwner = Exclude<Awaited<ReturnType<typeof requireKeyOwner>>, Response>;

/** Das Stundenlimit der Methode, Admins ausgenommen: die Absage als Antwort, sonst null. */
async function enforceKeyLimit(
  req: Request,
  { supabase, user }: KeyOwner,
  method: keyof typeof KEY_LIMITS,
  m: Messages["api"]
): Promise<Response | null> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  // Ein Lesefehler ist kein "kein Admin": die Route rät nicht.
  if (profileError) {
    captureError("api_key.profile_read_failed", profileError, { userId: user.id });
    return problem(503, m[KEY_LIMITS[method].failed]);
  }
  if (profile?.is_admin) return null;
  const rl = await KEY_LIMITS[method].check(req, user.id);
  return rl.allowed ? null : rateLimitedProblem(m.tooManyRequests, rl);
}

async function verifyKey(override: LlmOverride, m: Messages["api"]): Promise<Response | null> {
  // Der Key wird beim echten Anbieter geprüft, bevor er je gespeichert ist.
  //
  // Die eine bewusste Ausnahme von der Regel, dem Browser nie den Fehlertext eines Anbieters zu zeigen (der Chat ordnet
  // ihn ein, classifyLlmFailure): hier liest ihn nur der Besitzer des Keys, mitten im Einrichten, und
  // "invalid_api_key" oder "model not found" ist genau die Angabe, mit der er weiterkommt. Kein anderer Weg nutzt das.
  try {
    await chatComplete({
      system: "Antworte ausschliesslich mit dem einen Wort OK.",
      messages: [{ role: "user", content: "Test." }],
      maxOutputTokens: 10,
      override,
    });
  } catch (err) {
    return problem(
      400,
      fmt(m.keyVerifyFailed, { reason: err instanceof Error ? err.message : m.keyVerifyUnknown })
    );
  }
  return null;
}
