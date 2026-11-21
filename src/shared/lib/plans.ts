/**
 * Es gibt einen Plan: Free. PromptPrinter ist kostenlos und Open Source, bezahlt wird nichts.
 *
 * Die Spalte `profiles.plan` bleibt in der Datenbank, der Code liest ihren Wert nicht mehr: auch eine alte Zeile
 * mit `'pro'` ist ein Free-Konto (toPlanKey). `plan` steht weiter in Antworten wie `api/cli/me` und in den
 * Ablehnungen des Chats, damit deren Form für die Terminal-App gleich bleibt.
 */
export type PlanKey = "free";

export type PlanLimits = { projects: number; chatMessages: number };

/**
 * Was ein Konto darf.
 *
 * `chatMessages` ist der Zugang zum Server-Key: 0 heisst, das Konto chattet mit eigenem Key (BYOK) oder im
 * Gratis-Rahmen (FREE_TRIAL, server/free-trial.ts), `Infinity` (nur Admins, effectiveLimits) heisst ohne Grenze.
 * Ein Monatskontingent dazwischen gibt es nicht. Ein eigener Key hebt die Chat-Grenze immer auf, die Projekt-Grenze
 * bleibt.
 *
 * Prompts speichern zählt nicht: es ruft kein Modell auf. ACCOUNT_CEILINGS unten ist eine technische Obergrenze,
 * keine Grenze des Plans.
 *
 * `free.projects` steht zusätzlich im Trigger enforce_project_cap der Datenbank, denn die Route ist nicht der
 * einzige Schreibweg (tests/guards/account-ceilings.test.ts hält beide gleich).
 */
export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: { projects: 3, chatMessages: 0 },
};

/**
 * Der Gratis-Rahmen eines Kontos ohne eigenen Key: so viele fertige Prompts über den Server-Key, und höchstens
 * so viele Züge (eine Rückfrage ist ein Zug, aber kein Prompt). Er gilt einmal je Konto, nicht je Monat.
 * Durchgesetzt in server/free-trial.ts, mit Grenze je IP und eigenem Tagesbudget, weil Konten ohne
 * Mailbestätigung entstehen.
 */
export const FREE_TRIAL = { prompts: 3, turns: 10 } as const;

const MIB = 1024 * 1024;

/**
 * Obergrenzen je Konto, auch für Admins. Sie schützen die gemeinsame Datenbank und den Speicher vor einem
 * einzelnen Konto, normale Nutzung stösst nie an. Durchgesetzt werden sie in der Datenbank (Migration
 * `*_account_ceilings.sql`, für die Versionen `*_saved_prompt_versions.sql`), die Zahlen hier sind ihr Spiegel für
 * Tests und Doku. Rechnung und Verhalten an der Grenze: docs/SETUP.md, "Grenzen je Konto".
 */
export const ACCOUNT_CEILINGS = {
  conversations: { rows: 10_000 },
  messages: { rows: 50_000, bytes: 50 * MIB },
  savedPrompts: { rows: 5_000, bytes: 20 * MIB },
  savedPromptVersions: { rows: 20_000, bytes: 40 * MIB },
  projectFiles: { rows: 500 },
  projectFileStorage: { objects: 500, bytes: 100 * MIB },
} as const;

/**
 * Admin ist eine Rolle (`profiles.is_admin`), kein Plan: ein Admin-Konto hat keine Projekt-Grenze und den
 * Server-Key ohne Grenze (Stundenlimit und Tagesbudget gelten trotzdem, server/model-call.ts). Jede Stelle, die
 * "ist dieses Konto ausgenommen" fragt, fragt hier.
 */
export function effectiveLimits(plan: PlanKey, isAdmin: boolean): PlanLimits {
  return isAdmin ? { projects: Infinity, chatMessages: Infinity } : PLAN_LIMITS[plan];
}

/** Jeder gespeicherte Wert von `profiles.plan` ist Free, auch ein alter `'pro'`. */
export function toPlanKey(_raw: string | null | undefined): PlanKey {
  return "free";
}

/** Die zwei Spalten von `profiles`, aus denen Plan und Limits folgen. */
export type PlanProfile = { plan?: string | null; is_admin?: boolean | null } | null | undefined;

export type ResolvedPlan = { plan: PlanKey; isAdmin: boolean; limits: PlanLimits };

/**
 * Aus einer Zeile von `profiles` werden Plan, Admin-Status und die wirksamen Limits. Eine fehlende Zeile ist ein
 * Konto ohne Adminrechte. Jede Stelle, die "was darf dieses Konto" beantwortet (Chat, Projekte, Gedächtnis,
 * Seiten), ruft dies auf, statt die Folge nachzubauen (#141).
 */
export function resolvePlan(profile: PlanProfile): ResolvedPlan {
  const plan = toPlanKey(profile?.plan);
  const isAdmin = profile?.is_admin ?? false;
  return { plan, isAdmin, limits: effectiveLimits(plan, isAdmin) };
}

/**
 * Kann dieses Konto nur mit eigenem Key chatten, und hat es keinen?
 *
 * Genau der Zustand, in dem /api/chat nach dem Gratis-Rahmen mit `kind: "byokRequired"` ablehnt. Die Chat-Seiten
 * fragen das beim Rendern, damit der Hinweis schon im leeren Chat steht und nicht erst als Fehler nach dem
 * Absenden (Audit 23.09.2026, F-1).
 */
export function requiresOwnKey(plan: PlanKey, isAdmin: boolean, hasOwnKey: boolean): boolean {
  if (hasOwnKey) return false;
  return effectiveLimits(plan, isAdmin).chatMessages <= 0;
}
