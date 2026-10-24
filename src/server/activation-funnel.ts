import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Die Aktivierung nach Anmeldewoche (Audit 2026-10-18, #128): von wie vielen neuen Konten haben
// wie viele einen Key hinterlegt, eine Antwort von Finn bekommen und einen Prompt gespeichert.
// Nur Zähler über Daten, die der Dienst ohnehin speichert, nichts davon verlässt den Server und
// kein Inhalt wird gelesen. Nur für `is_admin` gedacht (Abschnitt "Betrieb" der Seite /usage),
// das Modul fragt über den Service-Role-Client quer über alle Konten.
//
// Eine Abfrage je Konto und Signal statt einer SQL-Funktion: Migrationen auf Produktion brauchen
// Kasums Ja, und die Auswertung soll sofort laufen. Bei dem Umfang des Produkts sind das ein paar
// Dutzend kleine Abfragen, die Obergrenze `FUNNEL_MAX_ACCOUNTS` hält sie im Rahmen. Wer weit mehr
// Konten hat, ersetzt `loadActivationFunnel` durch eine Aggregat-Funktion in der Datenbank.

/** Wie viele Wochen (die laufende eingeschlossen) die Ansicht zeigt. */
export const FUNNEL_WEEKS = 8;

/** Obergrenze der Konten, die ein Aufruf prüft; mehr gilt als abgeschnitten. */
export const FUNNEL_MAX_ACCOUNTS = 300;

/** Wie viele Konten gleichzeitig geprüft werden. */
const PROBE_CONCURRENCY = 25;

export type FunnelWeek = {
  /** Montag 00:00 UTC der Anmeldewoche, `YYYY-MM-DD`. */
  weekStart: string;
  signups: number;
  withKey: number;
  withAnswer: number;
  withSavedPrompt: number;
};

export type ActivationFunnel = {
  /** Älteste Woche zuerst, die laufende zuletzt; Wochen ohne Anmeldung stehen mit Nullen drin. */
  weeks: FunnelWeek[];
  /** Es gab mehr Konten als `FUNNEL_MAX_ACCOUNTS`, die ältesten fehlen. */
  truncated: boolean;
  /** Die Obergrenze, für den Hinweis bei `truncated`. */
  accountLimit: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Montag 00:00 UTC der Woche, in die `date` fällt. */
export function weekStartUtc(date: Date): Date {
  const day = (date.getUTCDay() + 6) % 7; // Montag = 0
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day));
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Beginn der ältesten gezeigten Woche. */
export function funnelSince(now: Date, weeks: number = FUNNEL_WEEKS): Date {
  return new Date(weekStartUtc(now).getTime() - (weeks - 1) * 7 * DAY_MS);
}

export type FunnelAccount = { id: string; created_at: string };
export type FunnelSignals = {
  withKey: ReadonlySet<string>;
  withAnswer: ReadonlySet<string>;
  withSavedPrompt: ReadonlySet<string>;
};

/** Verteilt Konten und ihre Signale auf Wochen. Rein, ohne Datenbank. */
export function buildFunnelWeeks(
  accounts: readonly FunnelAccount[],
  signals: FunnelSignals,
  now: Date,
  weeks: number = FUNNEL_WEEKS
): FunnelWeek[] {
  const first = funnelSince(now, weeks).getTime();
  const rows: FunnelWeek[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: isoDay(new Date(first + i * 7 * DAY_MS)),
    signups: 0,
    withKey: 0,
    withAnswer: 0,
    withSavedPrompt: 0,
  }));

  for (const account of accounts) {
    const created = new Date(account.created_at).getTime();
    if (Number.isNaN(created) || created < first) continue;
    const index = Math.floor((weekStartUtc(new Date(created)).getTime() - first) / (7 * DAY_MS));
    const row = rows[index];
    if (!row) continue; // jünger als die laufende Woche: Uhrenabweichung, nicht zählen
    row.signups += 1;
    if (signals.withKey.has(account.id)) row.withKey += 1;
    if (signals.withAnswer.has(account.id)) row.withAnswer += 1;
    if (signals.withSavedPrompt.has(account.id)) row.withSavedPrompt += 1;
  }
  return rows;
}

type Admin = Pick<SupabaseClient, "from">;

/** Welche der Konten in `table` mindestens eine Zeile haben (je Konto eine `limit(1)`-Abfrage). */
async function accountsWithRows(
  admin: Admin,
  table: string,
  ids: readonly string[],
  extra?: { column: string; value: string }
): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += PROBE_CONCURRENCY) {
    const batch = ids.slice(i, i + PROBE_CONCURRENCY);
    await Promise.all(
      batch.map(async (id) => {
        let query = admin.from(table).select("user_id").eq("user_id", id);
        if (extra) query = query.eq(extra.column, extra.value);
        const { data } = await query.limit(1);
        if (data && data.length > 0) found.add(id);
      })
    );
  }
  return found;
}

/**
 * Die Aktivierung der Konten der letzten `FUNNEL_WEEKS` Wochen.
 *
 * "Mit Key" meint: heute ein Key hinterlegt (wer ihn wieder entfernt, fällt heraus). "Mit Antwort"
 * und "mit gespeichertem Prompt" zählen, was noch gespeichert ist: wer den Chat oder den Prompt
 * gelöscht hat, fällt ebenfalls heraus. Die Zahlen sind eine Untergrenze, kein Protokoll.
 */
export async function loadActivationFunnel(
  admin: Admin,
  now: Date = new Date()
): Promise<ActivationFunnel> {
  const { data } = await admin
    .from("profiles")
    .select("id, created_at")
    .gte("created_at", funnelSince(now).toISOString())
    .order("created_at", { ascending: false })
    .limit(FUNNEL_MAX_ACCOUNTS + 1);

  const rows = (data ?? []) as FunnelAccount[];
  const truncated = rows.length > FUNNEL_MAX_ACCOUNTS;
  const accounts = rows.slice(0, FUNNEL_MAX_ACCOUNTS);
  const ids = accounts.map((a) => a.id);

  const [withKey, withAnswer, withSavedPrompt] = await Promise.all([
    accountsWithRows(admin, "user_api_keys", ids),
    // Eine Zeile je Zug: `role = assistant` ist die Antwort, nicht die Frage.
    accountsWithRows(admin, "messages", ids, { column: "role", value: "assistant" }),
    accountsWithRows(admin, "saved_prompts", ids),
  ]);

  return {
    weeks: buildFunnelWeeks(accounts, { withKey, withAnswer, withSavedPrompt }, now),
    truncated,
    accountLimit: FUNNEL_MAX_ACCOUNTS,
  };
}
