import "server-only";

/**
 * Der Einzelbetrieb: eine eigene Installation in EINEM Prozess (`npm start`, `npm run dev`, das Docker-Image), die
 * der Betreiber ausdrücklich mit `SELF_HOSTED=1` einschaltet (docs/SETUP.md, "Selbst betreiben"). Nur hier gilt:
 *
 * - Upstash ist keine Pflicht, das Ratenlimit zählt im Speicher des Prozesses (server/security/rate-limit.ts). In
 *   einem Prozess ist das eine echte Grenze, über mehrere Instanzen wäre es keine.
 * - Der Modell-Endpunkt des Betreibers (`LLM_BASE_URL`) darf auf dem eigenen Rechner oder im eigenen Netz liegen
 *   und http sprechen (server/security/url-safety.ts). Endpunkte, die Nutzer selbst eintragen (BYOK), nie.
 * - Ein Zug auf diesem Endpunkt kostet den Betreiber nichts pro Aufruf: er zählt nicht gegen Plan und Gratis-Rahmen
 *   (server/model-call.ts, selfHostedEndpointActive in llm/config.ts). Stundenlimit und Tagesbudget bleiben.
 *
 * Auf Vercel gilt der Schalter nie: dort laufen viele Instanzen, ein Limiter im Speicher begrenzt nichts, und
 * promptprinter.app darf durch eine falsch gesetzte Variable nicht lockerer werden. `assertEnv` (server/env.ts)
 * bricht den Start dort ab, statt den Wert still zu übergehen.
 */
export function isSelfHosted(env: Record<string, string | undefined> = process.env): boolean {
  return env.SELF_HOSTED?.trim() === "1" && !env.VERCEL?.trim();
}

/** `SELF_HOSTED=1` auf Vercel: ein Widerspruch, den der Start meldet (server/env.ts). */
export function hasSelfHostedOnVercel(env: Record<string, string | undefined> = process.env): boolean {
  return env.SELF_HOSTED?.trim() === "1" && Boolean(env.VERCEL?.trim());
}
