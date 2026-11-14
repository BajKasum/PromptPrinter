import "server-only";

import { fetchRepoHeadSha, GIT_SHA, parseGithubRepoUrl } from "@/server/brain/github";
import { redis } from "@/server/security/redis-client";

// Hat sich das analysierte GitHub-Repo seit der Analyse geändert? (#244)
//
// Eine einzige Anfrage an api.github.com (der Baum des Standard-Branches), verglichen mit der SHA, die die
// Analyse in project_brains.repo_ref gespeichert hat. Jede Unsicherheit heisst `null`, nie "veraltet": kein
// Hinweis ist besser als ein falscher (Repo gelöscht oder privat, Limit erreicht, GitHub nicht erreichbar,
// alter Eintrag ohne SHA).
//
// Der Zwischenspeicher in Redis hält die SHA kurz fest, damit ein Neuladen oder mehrere Projekte mit demselben
// Repo nicht jedes Mal fragen. Ein Fehlschlag wird noch kürzer gemerkt, damit ein erschöpftes Kontingent nicht
// von jedem Aufruf neu getroffen wird. Ohne Redis wird jedes Mal gefragt.

const CACHE_PREFIX = "promptprinter/brain-head";
const HEAD_TTL_SECONDS = 300;
const FAILURE_TTL_SECONDS = 60;
const FAILURE_MARK = "!";

export async function isRepoStale(
  repoUrl: string | null,
  storedRef: string | null,
  signal?: AbortSignal
): Promise<boolean | null> {
  if (!repoUrl || !storedRef || !GIT_SHA.test(storedRef)) return null;
  const ref = parseGithubRepoUrl(repoUrl);
  if (!ref) return null;

  const key = `${CACHE_PREFIX}:${ref.owner.toLowerCase()}/${ref.repo.toLowerCase()}`;
  let head: string | null = null;
  try {
    const cached = redis ? await redis.get<string>(key) : null;
    if (cached === FAILURE_MARK) return null;
    if (typeof cached === "string" && GIT_SHA.test(cached)) head = cached;
  } catch {
    // Redis nicht erreichbar: ohne Zwischenspeicher weiter.
  }

  if (head === null) {
    try {
      head = await fetchRepoHeadSha(ref, signal);
    } catch {
      // Ein Abbruch des Browsers ist kein Fehler bei GitHub: er darf die Prüfung nicht für alle sperren.
      if (signal?.aborted) return null;
      await remember(key, FAILURE_MARK, FAILURE_TTL_SECONDS);
      return null;
    }
    await remember(key, head, HEAD_TTL_SECONDS);
  }
  return head !== storedRef;
}

/**
 * Nach einer Analyse: die SHA, die sie gelesen hat, ist der Stand des Repos. Sonst hielte der Zwischenspeicher bis zu
 * HEAD_TTL_SECONDS lang die ältere SHA, und gleich nach "Neu analysieren" hiesse es "veraltet".
 */
export async function rememberRepoHead(repoUrl: string | null, sha: string | null): Promise<void> {
  if (!repoUrl || !sha || !GIT_SHA.test(sha)) return;
  const ref = parseGithubRepoUrl(repoUrl);
  if (!ref) return;
  await remember(`${CACHE_PREFIX}:${ref.owner.toLowerCase()}/${ref.repo.toLowerCase()}`, sha, HEAD_TTL_SECONDS);
}

async function remember(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // Best-effort: die nächste Prüfung fragt eben noch einmal.
  }
}
