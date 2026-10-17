import "server-only";

import { createAdminClient } from "@/server/supabase/admin";

/**
 * Die Einwilligung in die Übermittlung an Z.ai (Singapur), Rechts-Audit R-1.
 *
 * Im Pro-Plan geht jede Chat-Nachricht an Z.ai. Für Singapur (und China, wo
 * Z.ai-Konzerngesellschaften nicht auszuschliessen sind) gibt es weder einen
 * Angemessenheitsbeschluss der EU noch eine Anerkennung des Bundesrats, und die
 * Vereinbarung von Z.ai enthält keine Standardvertragsklauseln. Als Grundlage
 * bleibt die ausdrückliche, informierte Einwilligung (Art. 49 Abs. 1 lit. a
 * DSGVO, Art. 17 Abs. 1 lit. a revDSG). Der Chat fragt deshalb einmal, bevor der
 * erste Zug auf dem Server-Key läuft, und der Server prüft es bei jedem Zug.
 *
 * ⚠️ Das ist ein Notbehelf, keine Heilung. Der EDSA sieht Einwilligungen als
 * Ausnahme für gelegentliche Übermittlungen, nicht für eine dauerhafte; die
 * saubere Lösung sind Standardvertragsklauseln von Z.ai (Mail vom 2026-10-17,
 * Antwort steht aus) oder ein Anbieter mit solchen.
 *
 * Gespeichert wird beim Konto, in `app_metadata` (Supabase Auth): nur mit dem
 * Service-Role-Schlüssel beschreibbar, der Nutzer kann es nicht selbst setzen
 * und braucht dafür keine Tabelle und keine Migration. Wer den Hinweistext
 * wesentlich ändert, setzt ZAI_CONSENT_VERSION hoch, dann fragt der Chat neu.
 */
export const ZAI_CONSENT_VERSION = "2026-10-17";

export type ZaiConsent = { version: string; at: string };

/** Hat dieses Konto der aktuellen Fassung des Hinweises zugestimmt? */
export function zaiConsentOf(appMetadata: unknown): ZaiConsent | null {
  const raw = (appMetadata as { zai_consent?: Partial<ZaiConsent> | null } | null | undefined)?.zai_consent;
  if (!raw || raw.version !== ZAI_CONSENT_VERSION || typeof raw.at !== "string") return null;
  return { version: raw.version, at: raw.at };
}

export function hasZaiConsent(appMetadata: unknown): boolean {
  return zaiConsentOf(appMetadata) !== null;
}

/** Schreibt die Zustimmung (oder löscht sie, bei `granted: false`). Wirft bei einem Fehler. */
export async function setZaiConsent(userId: string, granted: boolean): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    // `null` entfernt den Schlüssel, die übrigen Felder in app_metadata bleiben.
    app_metadata: { zai_consent: granted ? { version: ZAI_CONSENT_VERSION, at: new Date().toISOString() } : null },
  });
  if (error) throw error;
}
