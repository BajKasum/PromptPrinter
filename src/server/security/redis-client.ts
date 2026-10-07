import "server-only";

import { Redis } from "@upstash/redis";

/**
 * Der gemeinsame Upstash-Client (aus rate-limit.ts ausgelagert, Dateigröße, Betriebs-Audit Folgesitzung
 * 2026-10-07). `null`, solange UPSTASH_REDIS_REST_URL und _TOKEN nicht beide gesetzt sind; was das heißt,
 * entscheidet jeder Aufrufer selbst (der Limiter lehnt in Produktion ab, Kontingent und Tagesbudgets
 * fallen auf keine Obergrenze zurück).
 *
 * Wird beim Laden des Moduls aus der Umgebung gelesen, wie bisher in rate-limit.ts: die Tests setzen die
 * Umgebung und laden das Modul neu.
 */
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;
