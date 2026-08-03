import "server-only";

import { Redis } from "@upstash/redis";

/**
 * Caches a project file's downloaded text content by its storage_path.
 * Every project chat turn re-injects every attached file (buildFilesContext
 * in api/chat/route.ts), which otherwise means one Storage round trip per
 * file per turn even though the files essentially never change mid-
 * conversation, pure latency + egress cost for nothing.
 *
 * Safe without any invalidation logic because storage_path is immutable
 * once a file is uploaded: project-files.tsx always writes to a fresh
 * `${user.id}/${projectId}/${uuid}-${name}` path, there is no in-place edit,
 * only upload (new path) + delete (removes the row). A cache entry for a
 * deleted file just becomes unreferenced (no row selects that path anymore)
 * and ages out via the TTL below, never serves stale content for a path
 * that's still in use.
 *
 * Falls back to always calling `download` when Upstash isn't configured,
 * same posture as rate-limit.ts: uncached but correct in dev/without it.
 */

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const CACHE_PREFIX = "promptprinter/project-file";
const TTL_SECONDS = 60 * 60;

export async function getCachedFileContent(
  storagePath: string,
  download: () => Promise<string | null>
): Promise<string | null> {
  if (!redis) return download();

  const key = `${CACHE_PREFIX}:${storagePath}`;
  try {
    const cached = await redis.get<string>(key);
    if (cached !== null && cached !== undefined) return cached;
  } catch {
    // Redis unreachable, degrade to an uncached download for this turn.
  }

  const text = await download();
  if (text !== null) {
    try {
      await redis.set(key, text, { ex: TTL_SECONDS });
    } catch {
      // Best-effort: a failed cache write just means the next turn re-downloads.
    }
  }
  return text;
}
