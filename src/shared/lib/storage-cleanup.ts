// Diese Datei lädt auch scripts/reconcile-project-files-storage.mjs, mit Node selbst und ohne Bundler. Deshalb bleibt
// sie ohne Importe und ohne TypeScript, das Node nicht einfach weglassen kann (enum, namespace); der Test des Skripts
// lädt sie so, wie Node es tut.

/**
 * How many storage paths go into one `storage.remove()` call.
 *
 * Supabase takes the paths as a JSON array in the request body, so one call
 * with thousands of entries is a single very large request — the failure mode
 * is the whole batch erroring out, which for account deletion means every file
 * is left behind rather than some.
 *
 * Deleting a PROJECT never needs this (MAX_FILES_PER_PROJECT caps it at 10),
 * but deleting an ACCOUNT removes every file across every project, and an admin
 * account has no project cap (shared/lib/plans.ts) — so that path has no upper bound at all.
 */
export const STORAGE_REMOVE_BATCH = 100;

export function chunkPaths(paths: string[], size: number = STORAGE_REMOVE_BATCH): string[][] {
  if (size < 1) throw new Error("chunkPaths: size must be >= 1");
  const out: string[][] = [];
  for (let i = 0; i < paths.length; i += size) out.push(paths.slice(i, i + size));
  return out;
}

/**
 * Entfernt jeden Pfad, in Stapeln, und macht weiter, wenn ein Stapel scheitert.
 *
 * Unabhängige Stapel mit Absicht: ein übrig gebliebenes Objekt ist unsichtbar und harmlos (Migration 0029), alle
 * liegen zu lassen, weil ein Stapel scheiterte, nicht. Gibt zurück, wie viele Pfade in gescheiterten Stapeln standen,
 * damit der Aufrufer eine Zahl melden kann, statt zu raten.
 */
export async function removeAllPaths(
  remove: (paths: string[]) => Promise<{ error: unknown } | void>,
  paths: string[],
  size: number = STORAGE_REMOVE_BATCH
): Promise<{ removed: number; failed: number }> {
  let removed = 0;
  let failed = 0;
  for (const batch of chunkPaths(paths, size)) {
    try {
      const result = await remove(batch);
      if (result && "error" in result && result.error) failed += batch.length;
      else removed += batch.length;
    } catch {
      failed += batch.length;
    }
  }
  return { removed, failed };
}

/** So viele Zeilen liefert PostgREST höchstens pro Antwort (Standard-max-rows). */
export const POSTGREST_PAGE_SIZE = 1000;

type PathPage = PromiseLike<{ data: { storage_path: string }[] | null; error: unknown }>;

/**
 * Liest alle `storage_path`-Werte einer Abfrage, seitenweise.
 *
 * PostgREST kappt eine Antwort bei 1000 Zeilen, ohne das zu melden. Wer die Pfade für das Aufräumen von
 * Storage-Objekten einsammelt und nach der ersten Seite aufhört, lässt alles dahinter als Waisen im Bucket
 * zurück, zu denen keine Zeile mehr zeigt (und die nach dem Löschen des Kontos niemandem mehr gehören).
 *
 * `page(from, to)` liefert die Zeilen `from` bis `to` (beide eingeschlossen) und sollte nach einer stabilen
 * Spalte sortieren (`id`), sonst sind zwei Seiten derselben Abfrage nicht garantiert überschneidungsfrei.
 *
 * WIRFT bei einem Lesefehler, statt eine halbe Liste zu liefern: der Aufrufer entscheidet, ob er den Fehler meldet
 * (Konto löschen: ja, aber nicht abbrechen) oder verschluckt. Mit `keepPartialOnError` kommen stattdessen die Pfade
 * der Seiten zurück, die gelesen wurden (Chat oder Projekt löschen, `attachment-storage.ts`).
 */
export async function collectStoragePaths(
  page: (from: number, to: number) => PathPage,
  {
    pageSize = POSTGREST_PAGE_SIZE,
    keepPartialOnError = false,
  }: { pageSize?: number; keepPartialOnError?: boolean } = {}
): Promise<string[]> {
  if (pageSize < 1) throw new Error("collectStoragePaths: pageSize must be >= 1");
  const paths: string[] = [];
  try {
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await page(from, from + pageSize - 1);
      if (error) throw error;
      paths.push(...(data ?? []).map((row) => row.storage_path));
      if (!data || data.length < pageSize) break;
    }
  } catch (err) {
    if (!keepPartialOnError) throw err;
  }
  return paths;
}
