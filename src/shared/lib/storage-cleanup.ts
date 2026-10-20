/**
 * How many storage paths go into one `storage.remove()` call.
 *
 * Supabase takes the paths as a JSON array in the request body, so one call
 * with thousands of entries is a single very large request — the failure mode
 * is the whole batch erroring out, which for account deletion means every file
 * is left behind rather than some.
 *
 * Deleting a PROJECT never needs this (MAX_FILES_PER_PROJECT caps it at 10),
 * but deleting an ACCOUNT removes every file across every project, and Pro has
 * no project cap (lib/plans.ts) — so that path has no upper bound at all.
 */
export const STORAGE_REMOVE_BATCH = 100;

export function chunkPaths(paths: string[], size: number = STORAGE_REMOVE_BATCH): string[][] {
  if (size < 1) throw new Error("chunkPaths: size must be >= 1");
  const out: string[][] = [];
  for (let i = 0; i < paths.length; i += size) out.push(paths.slice(i, i + size));
  return out;
}

/**
 * Removes every path, in batches, and keeps going if a batch fails.
 *
 * Independent batches on purpose: storage cleanup is best-effort in both of its
 * callers (a leftover object is invisible and harmless — see migration 0029 —
 * whereas blocking an account deletion on a storage hiccup is not), so one bad
 * batch must not abort the rest. Returns how many paths were in batches that
 * failed, so the caller can log a number instead of guessing.
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
 * (Konto löschen: ja, aber nicht abbrechen) oder verschluckt. Gegenstück ohne Wurf: `attachment-storage.ts`.
 */
export async function collectStoragePaths(
  page: (from: number, to: number) => PathPage,
  pageSize: number = POSTGREST_PAGE_SIZE
): Promise<string[]> {
  if (pageSize < 1) throw new Error("collectStoragePaths: pageSize must be >= 1");
  const paths: string[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    paths.push(...(data ?? []).map((row) => row.storage_path));
    if (!data || data.length < pageSize) break;
  }
  return paths;
}
