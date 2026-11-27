import "server-only";

import { Redis } from "@upstash/redis";

/**
 * Die gemeinsamen Upstash-Clients; gebaut wird nur hier (tests/guards/upstash-client.test.ts). Beide sind `null`,
 * solange UPSTASH_REDIS_REST_URL und _TOKEN nicht beide gesetzt sind; was das heißt, entscheidet jeder Aufrufer selbst
 * (der Limiter lehnt in Produktion ab, der Gratis-Rahmen ebenso, die Tagesbudgets fallen auf keine Obergrenze zurück).
 *
 * Wird beim Laden des Moduls aus der Umgebung gelesen: die Tests setzen die Umgebung und laden das Modul neu.
 */
const configured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

/** Der Client für Zähler, Marken und Mengen. Er wertet jede Antwort aus, die sich als JSON lesen lässt. */
export const redis = configured ? Redis.fromEnv() : null;

/**
 * Für Werte, die selbst Text sind (Dateitext, server/project-file-cache.ts): ohne diese Auswertung. Über `redis` käme
 * eine package.json als Objekt zurück, eine Datei mit dem Inhalt "42" als Zahl.
 */
export const rawRedis = configured ? Redis.fromEnv({ automaticDeserialization: false }) : null;
