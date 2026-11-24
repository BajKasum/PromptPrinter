import "server-only";

import { Redis } from "@upstash/redis";

/**
 * Hält den Text einer Projektdatei je `storage_path` eine Stunde in Upstash. Jeder Zug eines Projekt-Chats gibt alle
 * angehängten Dateien neu mit (`loadProjectFiles` in features/projects/lib/project-context.ts); ohne Cache kostete
 * das je Datei und Zug einen Abruf aus dem Storage, obwohl sich die Dateien während eines Gesprächs nicht ändern.
 *
 * Ohne Invalidierung richtig, weil `storage_path` nach dem Hochladen feststeht: project-files.tsx lädt jede Datei
 * unter einem neuen Pfad mit eigener ID hoch, geändert wird nie an Ort und Stelle, nur neu hochgeladen (neuer Pfad)
 * oder gelöscht (die Zeile verschwindet). Ein Eintrag zu einer gelöschten Datei liest niemand mehr, er läuft mit der
 * TTL unten ab.
 *
 * Ohne Upstash lädt jeder Aufruf direkt, wie in rate-limit.ts: ungecacht, aber richtig.
 */

// Der Cache hält Dateitext, kein JSON. Mit der Voreinstellung wertet der Client jede Antwort aus, die sich als JSON
// lesen lässt: eine package.json käme als Objekt zurück, eine Datei mit dem Inhalt "42" als Zahl.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv({ automaticDeserialization: false })
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
    // Nur Text ist ein Treffer. Was sonst aus Upstash kommt, wird neu geladen, statt als Dateitext weiterzugehen.
    const cached: unknown = await redis.get(key);
    if (typeof cached === "string") return cached;
  } catch {
    // Upstash nicht erreichbar: für diesen Zug ungecacht laden.
  }

  const text = await download();
  if (text !== null) {
    try {
      await redis.set(key, text, { ex: TTL_SECONDS });
    } catch {
      // Ein gescheitertes Schreiben heisst nur, dass der nächste Zug wieder lädt.
    }
  }
  return text;
}
