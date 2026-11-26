/**
 * Versionen gespeicherter Prompts im Browser und auf dem Server. Die Versionen selbst legt die Datenbank an
 * (Migration 0061, Trigger auf `saved_prompts`); hier stehen nur die Formen, die beide Seiten teilen.
 */

/** Ein gespeicherter Prompt, von dem Speichern im Chat eine neue Version anbietet (server/prompt-version-target.ts). */
export type VersionTarget = { id: string; title: string; prompt: string };

/**
 * Nummer und Zeit einer Zeile aus `saved_prompt_versions`: so viel liest der Verlauf an der Karte für die Auswahl. Den
 * Text holt er nur für die beiden Fassungen, die er vergleicht.
 */
export type PromptVersion = { version: number; createdAt: string };

/** So viele Versionen zeigt der Verlauf auf einmal, die älteren auf Wunsch. */
export const VERSIONS_PAGE = 20;

/**
 * Bietet Speichern eine neue Version an? Nur wenn es einen Kandidaten gibt und der Text sich von dessen aktueller
 * Fassung unterscheidet: derselbe Text legte in der Datenbank ohnehin keine Version an.
 */
export function offersNewVersion(target: VersionTarget | null | undefined, prompt: string): target is VersionTarget {
  return Boolean(target && target.prompt !== prompt);
}
