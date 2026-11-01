import "server-only";

import {
  chatQuotaKey,
  reserveMonthlyQuota,
  reserveServerKeyCall,
} from "@/server/security/rate-limit";
import type { rateLimit } from "@/server/security/rate-limit";
import type { createClient } from "@/server/supabase/server";
import { llmConfig } from "@/server/llm";
import { getUserOverride } from "@/server/byok";
import { hasZaiConsent } from "@/server/consent";
import { problem } from "@/server/http/api-problem";
import { DatabaseReadError, orThrow } from "@/server/supabase/query";
import { captureError } from "@/shared/lib/observability";
import { resolvePlan } from "@/shared/lib/plans";
import { PRO_AVAILABLE } from "@/shared/lib/pro-availability";
import { fmt } from "@/shared/i18n/format";
import type { Messages } from "@/shared/i18n/messages/de";

// Die Kette vor einem Modellaufruf, den ein Konto auslöst: Plan, eigener Key, Einwilligung,
// Monatskontingent, Stundenlimit, Tagesbudget des Server-Keys, Konfiguration. Es ist die
// Kostenbremse des Projekts, deshalb steht sie nur hier: /api/chat (chat/allowance.ts) und die
// Gedächtnis-Analyse (api/projects/[id]/brain) rufen dieselbe Funktion und unterscheiden sich nur
// in den Optionen. Eine Änderung der Regel (neuer Plan, weitere Einwilligung, weiterer Schutz)
// gilt damit für beide.
//
// Die Reihenfolge ist Vertrag, und JEDER Ausstieg gibt zurück, was bis dahin reserviert war
// (releaseReservations): Plan und Key lesen, Free ohne Key, Einwilligung, Monatskontingent,
// Stundenlimit, Tagesbudget (letzte Prüfung vor dem Modell), Konfiguration. Vor der ersten
// Reservierung kostet eine Ablehnung nichts. route.exits.test.ts hält sie für den Chat fest.

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export type ModelCallAllowance = {
  /** Der eigene Key des Nutzers (BYOK), oder null: dann läuft der Zug auf dem Server-Key. */
  override: Exclude<Awaited<ReturnType<typeof getUserOverride>>, "unreadable">;
  plan: ReturnType<typeof resolvePlan>["plan"];
  isAdmin: boolean;
  /** Gibt jede Reservierung dieses Zugs zurück. Aufzurufen, sobald der Zug nichts gekostet hat. */
  releaseReservations: () => Promise<void>;
};

export type ModelCallOptions = {
  supabase: SupabaseClient;
  userId: string;
  /** app_metadata des Kontos (Einwilligung in die Übermittlung an Z.ai, server/consent.ts). */
  appMetadata: unknown;
  m: Messages["api"];
  /**
   * Das Stundenlimit, Admins ausgenommen. Der Aufrufer prüft es selbst (rateLimit mit eigenem
   * Bereich und eigener Grenze): jeder Aufruf-Typ zählt in einem eigenen Zähler, und den Bereich
   * als Literal im Aufruf verlangt tests/guards/rate-limit-scopes.test.ts.
   */
  checkHourlyLimit: () => ReturnType<typeof rateLimit>;
  /** Die Ablehnungstexte des Aufruf-Typs. `monthlyLimit` trägt {plan} und {limit}. */
  texts: { monthlyLimit: string; tooMany: string; budget: string; notConfigured: string; unavailable: string };
  /**
   * Ohne Server-Anbieter antwortet der Aufruf in der Entwicklung mit einer Platzhalterantwort
   * (Stub), nur in Produktion verweigert er den Dienst. Aus: auch in der Entwicklung eine klare
   * Absage. Die Analyse stellt das aus, weil eine erfundene Faktenliste schlimmer ist als keine.
   */
  stubOutsideProduction: boolean;
};

export async function reserveModelCall(opts: ModelCallOptions): Promise<ModelCallAllowance | Response> {
  const { supabase, userId, m, texts } = opts;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  // Ein Lesefehler ist weder "Plan Free" noch "kein eigener Key": das lehnte ein Pro-Konto mit dem Hinweis auf einen
  // eigenen Key ab oder schickte den Zug auf den Server-Key. Vor jeder Reservierung also 503, eine Ablehnung kostet nichts.
  let profile: Awaited<ReturnType<typeof readProfile>>;
  let override: Awaited<ReturnType<typeof getUserOverride>>;
  try {
    [profile, override] = await Promise.all([readProfile(supabase, userId), getUserOverride(userId)]);
  } catch (err) {
    return unavailable(err, userId, texts.unavailable);
  }
  // Vor jeder Reservierung, eine Ablehnung kostet nichts. Kein Rückfall auf den Server-Key (byok.ts).
  if (override === "unreadable") {
    return problem(409, m.byokUnreadable, { kind: "byokUnreadable" });
  }

  const { plan, isAdmin, limits } = resolvePlan(profile);

  // Die Plätze, die für diesen Aufruf reserviert sind (Monatskontingent, globales Tagesbudget).
  // Scheitert der Modellaufruf selbst, gehen sie zurück, damit ein gescheiterter Zug niemandes
  // Kontingent verbraucht. Beide müssen auf jedem Fehlerweg zurück.
  const reservations: (() => Promise<void>)[] = [];
  const releaseReservations = async () => {
    for (const release of reservations) await release();
    reservations.length = 0;
  };

  if (!override) {
    const refused = await reserveMonthlySlot({ ...opts, plan, limit: limits.chatMessages, now, monthStart, reservations });
    if (refused) return refused;
  }

  // Stundenlimit, Admins ausgenommen. Anonyme Aufrufer kommen nie bis hierher.
  if (!isAdmin) {
    const rl = await opts.checkHourlyLimit();
    if (!rl.allowed) {
      await releaseReservations();
      return problem(429, texts.tooMany, {
        retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
      });
    }
  }

  // Globale Tagesgrenze für den Server-Key (QA-Befund S-1, Schritt 4). Jede Kontrolle davor geht
  // davon aus, dass der Angreifer ein Nutzer ist, und begrenzt ihn einzeln; diese hier begrenzt
  // die RECHNUNG, wer auch immer sie über welches Loch treibt. Sie ist die Rückversicherung für
  // das nächste Leck, das noch niemand gefunden hat.
  //
  // Nur für Aufrufe, die den Server-Key wirklich ausgeben: ein BYOK-Nutzer läuft auf seinem
  // eigenen Konto, kostet den Betreiber nichts und arbeitet weiter, auch wenn das hier ausgelöst
  // hat. Die letzte Prüfung vor dem Modell, damit ein früher abgelehnter Aufruf nichts verbraucht.
  if (!override) {
    const refused = await reserveDailyBudget(texts.budget, reservations, releaseReservations);
    if (refused) return refused;
  }

  // Ohne Server-Anbieter nicht still mit der Platzhalterantwort antworten (QA-Befund C-8). Der
  // Stub ist ein Merkmal für Entwicklung und Tests, der ganze Ablauf bleibt ohne Key testbar. In
  // Produktion (fehlender ZAI_API_KEY/GEMINI_API_KEY, beim Start nur gewarnt, siehe assertEnv() in
  // server/env.ts) wäre er ein stiller Totalausfall der einen Sache, die das Produkt tut: alle
  // bekämen eine glaubhafte Platzhalterantwort, und nichts würde anzeigen, dass etwas fehlt. Ein
  // BYOK-Key umgeht das immer, er berührt die Konfiguration des Servers nie.
  const stubAllowed = opts.stubOutsideProduction && process.env.NODE_ENV !== "production";
  if (!llmConfig() && !override && !stubAllowed) {
    await releaseReservations();
    return problem(503, texts.notConfigured);
  }
  return { override, plan, isAdmin, releaseReservations };
}

// Eine Zeile je Zug: completeTurn schreibt zu jeder Nutzer-Nachricht genau eine Antwort, die
// Zählung nur dieser Rolle zählt einen Zug nicht doppelt. Das ist auch die Zahl in
// Einstellungen und Abrechnung.
//
// Faul gelesen (Betriebs-Audit 04.10.2026): die Zählung wächst mit der Nutzung und wird nur an
// zwei Stellen gebraucht, (a) wenn Redis nicht entscheiden kann, dann IST sie die Durchsetzung,
// und (b) wenn eine Ablehnung die Zahl nennen muss.
// Gibt null zurück, wenn die Zählung scheitert: ein Fehler ist NICHT 0, sonst wäre ohne Redis das Monatskontingent
// nicht durchgesetzt. Der Aufrufer entscheidet, was null heißt.
async function countAssistantMessagesThisMonth(
  supabase: SupabaseClient,
  userId: string,
  monthStart: string
): Promise<number | null> {
  try {
    const { count } = orThrow(
      await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("role", "assistant")
        .gte("created_at", monthStart),
      "messages count"
    );
    return count ?? 0;
  } catch (err) {
    if (!(err instanceof DatabaseReadError)) throw err;
    captureError("model_call.read_failed", err, { userId });
    return null;
  }
}

/** Zugang zum Server-Key und Platz im Monatskontingent: die Absage als Antwort, sonst null. */
async function reserveMonthlySlot(args: ModelCallOptions & {
  plan: string;
  limit: number;
  now: Date;
  monthStart: string;
  reservations: (() => Promise<void>)[];
}): Promise<Response | null> {
  const { supabase, userId, appMetadata, m, texts, plan, limit, now, monthStart, reservations } = args;
  // Free hat bewusst genau null Antworten (plans.ts): der Plan hat keinen Zugang zum Server-Key,
  // zum Chatten braucht Free einen eigenen Key. Das ist etwas anderes als "Limit erreicht" (da
  // gab es ein Kontingent und es ist aufgebraucht) und bekommt eine eigene Meldung. Es gibt
  // nichts zu reservieren, und kein Grund, bei jedem Versuch einen Redis-Aufruf dafür zu zahlen.
  if (limit <= 0) {
    return problem(
      403,
      // Ohne buchbaren Pro-Plan darf die Meldung nicht zu Pro raten (pro-availability.ts).
      PRO_AVAILABLE ? m.byokRequired : m.byokRequiredSoon,
      { kind: "byokRequired", plan }
    );
  }

  // Läuft dieser Aufruf auf Z.ai, braucht das Konto vorher die ausdrückliche Zustimmung zur
  // Übermittlung nach Singapur (Rechts-Audit R-1, server/consent.ts). Vor jeder Reservierung,
  // damit eine Ablehnung nichts kostet und nichts zurückgeben muss. Der eigene Key (BYOK) geht
  // nie an Z.ai und braucht sie nicht; ohne Server-Key (Stub) auch nicht.
  if (llmConfig()?.provider === "zai" && !hasZaiConsent(appMetadata)) {
    return problem(403, m.consentRequired, { kind: "consentRequired" });
  }

  // Beide Aufruf-Typen zählen gegen dasselbe Monatskontingent, mit demselben Schlüssel
  // (chatQuotaKey): ein zweiter Zähler wäre ein zweites Versprechen, das die Preisseite nicht
  // macht, und der Nutzer müsste zwei Budgets im Kopf haben.
  const reservation = await reserveMonthlyQuota(chatQuotaKey(userId, now), limit);
  // null = Redis kann nicht entscheiden (nicht konfiguriert oder nicht erreichbar): dann ist die
  // Zählung in der Datenbank die Durchsetzung. Das gilt für beide Aufruf-Typen gleich: ohne
  // Redis darf eine Analyse nicht mehr, als ein aufgebrauchtes Monatskontingent mit Redis erlaubte.
  let used: number | null = null;
  if (!reservation) {
    used = await countAssistantMessagesThisMonth(supabase, userId, monthStart);
    if (used === null) return problem(503, texts.unavailable);
  }
  const overLimit = reservation ? !reservation.allowed : (used ?? 0) >= limit;
  if (overLimit) {
    if (reservation) await reservation.release();
    // Die Zahl steht in der Ablehnung: der eine Fall, in dem der Redis-Weg noch zählt, und ein
    // seltener (das Konto steht an seiner Grenze).
    used ??= await countAssistantMessagesThisMonth(supabase, userId, monthStart);
    // Scheitert hier die Zählung, bleibt es bei der Ablehnung, nur ohne die Zahl: eine Ablehnung lockert nichts.
    return problem(403, fmt(texts.monthlyLimit, { plan, limit: limit }), {
      kind: "chatMessages",
      limit: limit,
      ...(used === null ? {} : { current: used }),
      plan,
    });
  }
  if (reservation) reservations.push(reservation.release);
  return null;
}

async function reserveDailyBudget(
  budgetText: string,
  reservations: (() => Promise<void>)[],
  releaseReservations: () => Promise<void>
): Promise<Response | null> {
  const budget = await reserveServerKeyCall();
  if (budget && !budget.allowed) {
    await budget.release();
    await releaseReservations();
    return problem(503, budgetText);
  }
  if (budget) reservations.push(budget.release);
  return null;
}

async function readProfile(supabase: SupabaseClient, userId: string) {
  const { data } = orThrow(
    await supabase.from("profiles").select("plan, is_admin").eq("id", userId).maybeSingle(),
    "profiles"
  );
  return data;
}

/** Ein Lesefehler wird zu 503 mit Logeintrag; alles andere ist ein Programmfehler und wird weitergeworfen. */
function unavailable(err: unknown, userId: string, message: string): Response {
  if (!(err instanceof DatabaseReadError)) throw err;
  captureError("model_call.read_failed", err, { userId });
  return problem(503, message);
}
