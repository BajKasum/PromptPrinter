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
