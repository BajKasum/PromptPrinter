import "server-only";

import { reserveServerKeyCall } from "@/server/security/rate-limit";
import type { rateLimit } from "@/server/security/rate-limit";
import type { createClient } from "@/server/supabase/server";
import { llmConfig, selfHostedEndpointActive } from "@/server/llm";
import { getUserOverride } from "@/server/byok";
import { hasZaiConsent } from "@/server/consent";
import { freePromptsLeft, reserveFreeTrialTestRun, reserveFreeTrialTurn, type FreeTrialSlot } from "@/server/free-trial";
import { problem, rateLimitedProblem } from "@/server/http/api-problem";
import { DatabaseReadError, orThrow } from "@/server/supabase/query";
import { captureError } from "@/shared/lib/observability";
import { resolvePlan } from "@/shared/lib/plans";
import type { Messages } from "@/shared/i18n/messages/de";

// Die Kette vor einem Modellaufruf, den ein Konto auslöst: eigener Key, Zugang zum Server-Key (Gratis-Rahmen oder
// Admin), Einwilligung, Stundenlimit, Tagesbudget des Server-Keys, Konfiguration. Es ist die Kostenbremse des
// Projekts, deshalb steht sie nur hier: /api/chat (chat/allowance.ts), der Probelauf (api/test-run) und die
// Gedächtnis-Analyse (api/projects/[id]/brain) rufen dieselbe Funktion und unterscheiden sich nur in den Optionen.
// Eine weitere Einwilligung oder ein weiterer Schutz gilt damit für alle drei.
//
// Wer auf den Server-Key darf (shared/lib/plans.ts): ein Konto ohne eigenen Key nur im Gratis-Rahmen
// (server/free-trial.ts), und den bietet nur ein Aufrufer an, der `freeTrial` übergibt; ein Admin ohne Grenze. Ein
// Monatskontingent gibt es nicht, also auch keinen Zähler je Konto und Monat. Im Einzelbetrieb gilt beides nicht
// (server/self-hosted.ts).
//
// Die Reihenfolge ist Vertrag, und JEDER Ausstieg gibt zurück, was bis dahin reserviert war
// (releaseReservations): Plan und Key lesen, Zugang zum Server-Key mit Einwilligung (der Gratis-Rahmen reserviert
// danach seinen Platz), Stundenlimit, Tagesbudget (letzte Prüfung vor dem Modell), Konfiguration. Vor der ersten
// Reservierung kostet eine Ablehnung nichts. route.exits.test.ts hält sie für den Chat fest.

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export type ModelCallAllowance = {
  /** Der eigene Key des Nutzers (BYOK), oder null: dann läuft der Zug auf dem Server-Key. */
  override: Exclude<Awaited<ReturnType<typeof getUserOverride>>, "unreadable">;
  plan: ReturnType<typeof resolvePlan>["plan"];
  isAdmin: boolean;
  /** Der Zug läuft im Gratis-Rahmen (server/free-trial.ts), sonst null. */
  freeTrial: FreeTrialSlot | null;
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
  /** Die Ablehnungstexte des Aufruf-Typs. */
  texts: { tooMany: string; budget: string; notConfigured: string; unavailable: string };
  /**
   * Ohne Server-Anbieter antwortet der Aufruf in der Entwicklung mit einer Platzhalterantwort
   * (Stub), nur in Produktion verweigert er den Dienst. Aus: auch in der Entwicklung eine klare
   * Absage. Die Analyse stellt das aus, weil eine erfundene Faktenliste schlimmer ist als keine.
   */
  stubOutsideProduction: boolean;
  /**
   * Chat und Probelauf: ein Konto ohne eigenen Key darf im Gratis-Rahmen auf den Server-Key (server/free-trial.ts).
   * `budget` ist die Absage, wenn der Rahmen heute aufgebraucht ist. Ohne die Option braucht ein Konto ohne
   * eigenen Key einen (byokRequired), die Analyse bietet den Rahmen deshalb nicht an.
   */
  freeTrial?: {
    req: Request;
    budget: string;
    /**
     * Probelauf (api/test-run): der Hash des gelieferten Prompts (deliveredPromptHash). Dann zählt ein Probelauf je
     * Prompt statt ein Zug, und nur für einen Prompt, den Finn dem Konto geliefert hat.
     */
    testRunOf?: { promptHash: string; used: string; accountUsed: string; notDelivered: string };
  };
};

export async function reserveModelCall(opts: ModelCallOptions): Promise<ModelCallAllowance | Response> {
  const { supabase, userId, m, texts } = opts;
  // Ein Lesefehler ist weder "kein Admin" noch "kein eigener Key": das lehnte einen Admin mit dem Hinweis auf einen
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

  // Die Plätze, die für diesen Aufruf reserviert sind (Gratis-Rahmen, globales Tagesbudget). Scheitert der
  // Modellaufruf selbst, gehen sie zurück, damit ein gescheiterter Zug niemandem etwas verbraucht. Alle müssen auf
  // jedem Fehlerweg zurück.
  const reservations: (() => Promise<void>)[] = [];
  const releaseReservations = async () => {
    for (const release of reservations) await release();
    reservations.length = 0;
  };

  // Im Einzelbetrieb läuft ein Zug ohne eigenen Key auf dem Endpunkt des Betreibers (llm/config.ts): er kostet
  // ihn nichts je Aufruf, Gratis-Rahmen und Einwilligung gelten dann nicht, wie bei einem eigenen Key. Stundenlimit
  // und Tagesbudget unten bleiben. Ohne SELF_HOSTED (promptprinter.app) ist das nie wahr.
  let freeTrial: FreeTrialSlot | null = null;
  if (!override && !selfHostedEndpointActive()) {
    const slot = await reserveServerKeyAccess({ ...opts, plan, limit: limits.chatMessages, reservations });
    if (slot instanceof Response) return slot;
    freeTrial = slot;
  }

  // Stundenlimit, Admins ausgenommen. Anonyme Aufrufer kommen nie bis hierher.
  if (!isAdmin) {
    const rl = await opts.checkHourlyLimit();
    if (!rl.allowed) {
      await releaseReservations();
      return rateLimitedProblem(texts.tooMany, rl);
    }
  }

  // Globale Tagesgrenze für den Server-Key. Jede Kontrolle davor geht davon aus, dass der Angreifer ein Nutzer ist,
  // und begrenzt ihn einzeln; diese hier begrenzt die RECHNUNG, wer auch immer sie über welches Loch treibt. Sie ist
  // die Rückversicherung für das nächste Leck, das noch niemand gefunden hat.
  //
  // Nur für Aufrufe, die den Server-Key wirklich ausgeben: ein BYOK-Nutzer läuft auf seinem
  // eigenen Konto, kostet den Betreiber nichts und arbeitet weiter, auch wenn das hier ausgelöst
  // hat. Die letzte Prüfung vor dem Modell, damit ein früher abgelehnter Aufruf nichts verbraucht.
  if (!override) {
    const refused = await reserveDailyBudget(texts.budget, reservations, releaseReservations);
    if (refused) return refused;
  }

  // Ohne Server-Anbieter nicht still mit der Platzhalterantwort antworten. Der Stub ist ein Merkmal für Entwicklung
  // und Tests, der ganze Ablauf bleibt ohne Key testbar. In Produktion (fehlender ZAI_API_KEY/GEMINI_API_KEY, beim
  // Start nur gewarnt, siehe assertEnv() in server/env.ts) wäre er ein stiller Totalausfall der einen Sache, die das
  // Produkt tut: alle bekämen eine glaubhafte Platzhalterantwort, und nichts würde anzeigen, dass etwas fehlt. Ein
  // BYOK-Key umgeht das immer, er berührt die Konfiguration des Servers nie.
  const stubAllowed = opts.stubOutsideProduction && process.env.NODE_ENV !== "production";
  if (!llmConfig() && !override && !stubAllowed) {
    await releaseReservations();
    return problem(503, texts.notConfigured);
  }
  return { override, plan, isAdmin, freeTrial, releaseReservations };
}

/**
 * Darf dieser Aufruf ohne eigenen Key auf den Server-Key? Die Absage als Antwort, ein Platz im Gratis-Rahmen, oder
 * null (Admin: ohne Grenze, nichts zu reservieren).
 *
 * `limit` ist `chatMessages` aus plans.ts: 0 für jedes Konto, das kein Admin ist, auch für eine alte Zeile mit
 * `plan = 'pro'` (toPlanKey), `Infinity` für Admins. Werte dazwischen gibt es nicht.
 */
async function reserveServerKeyAccess(args: ModelCallOptions & {
  plan: string;
  limit: number;
  reservations: (() => Promise<void>)[];
}): Promise<Response | FreeTrialSlot | null> {
  const { appMetadata, m, plan, limit, reservations } = args;
  if (limit <= 0) {
    if (args.freeTrial) return reserveFreeTrialSlot(args, args.freeTrial, reservations);
    // Ohne Gratis-Rahmen (Analyse) bleibt nur der eigene Key. Es gibt nichts zu reservieren, und kein Grund, bei
    // jedem Versuch einen Redis-Aufruf dafür zu zahlen.
    return problem(403, m.byokRequired, { kind: "byokRequired", plan });
  }

  // Ein Admin läuft ohne Grenze auf dem Server-Key. Läuft der auf Z.ai, braucht auch er vorher die ausdrückliche
  // Zustimmung zur Übermittlung nach Singapur (server/consent.ts): die Übermittlung ist dieselbe. Vor jeder
  // Reservierung, damit eine Ablehnung nichts kostet. Der eigene Key (BYOK) geht nie an Z.ai und braucht sie nicht;
  // ohne Server-Key (Stub) auch nicht.
  if (llmConfig()?.provider === "zai" && !hasZaiConsent(appMetadata)) {
    return problem(403, m.consentRequired, { kind: "consentRequired" });
  }
  return null;
}

/**
 * Der Gratis-Rahmen. Erst ob überhaupt noch etwas übrig ist (sonst zählt der Key-Weg, nicht die Einwilligung), dann
 * die Einwilligung: bis dahin kostet eine Ablehnung nichts. Aufgebraucht heisst derselbe Weg wie ohne Rahmen
 * (byokRequired), ein leeres Tagesbudget bekommt eine eigene Art, damit der Chat sagt, dass es morgen wieder geht.
 */
async function reserveFreeTrialSlot(
  args: ModelCallOptions & { plan: string },
  freeTrial: NonNullable<ModelCallOptions["freeTrial"]>,
  reservations: (() => Promise<void>)[]
): Promise<Response | FreeTrialSlot> {
  const { userId, appMetadata, m, plan } = args;
  const byokRequired = (freeTrial: string) => problem(403, m.byokRequired, { kind: "byokRequired", plan, freeTrial });
  // Ein Probelauf gilt einem Prompt, den das Konto schon hat: auch der letzte Gratis-Prompt darf ihn noch haben.
  if (!freeTrial.testRunOf) {
    const left = await freePromptsLeft(userId);
    if (left === null) return byokRequired("unavailable");
    if (left <= 0) return byokRequired("exhausted");
  }
  if (llmConfig()?.provider === "zai" && !hasZaiConsent(appMetadata)) {
    return problem(403, m.consentRequired, { kind: "consentRequired" });
  }
  const slot = freeTrial.testRunOf
    ? await reserveFreeTrialTestRun(freeTrial.req, userId, freeTrial.testRunOf.promptHash)
    : await reserveFreeTrialTurn(freeTrial.req, userId);
  if (slot === "used") return problem(403, freeTrial.testRunOf?.used ?? freeTrial.budget, { kind: "testRunUsed", plan });
  if (slot === "accountUsed") {
    return problem(403, freeTrial.testRunOf?.accountUsed ?? freeTrial.budget, { kind: "testRunsUsed", plan });
  }
  if (slot === "notDelivered") {
    return problem(403, freeTrial.testRunOf?.notDelivered ?? freeTrial.budget, { kind: "testRunNotDelivered", plan });
  }
  if (slot === "budget") return problem(403, freeTrial.budget, { kind: "freeTrialBudget", plan });
  if (typeof slot === "string") return byokRequired(slot);
  reservations.push(slot.release);
  return slot;
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
