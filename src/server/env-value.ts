import "server-only";

/**
 * Eine OPTIONALE Umgebungsvariable: leer, nur Leerzeichen und nicht gesetzt sind
 * dasselbe, `undefined`. Sonst der Wert ohne Leerraum an den Rändern.
 *
 * Warum nicht `process.env.X ?? Standard`: `??` springt nur bei `undefined` an. Ein
 * LEER gesetztes `ZAI_MODEL=` (ein leeres Feld in Vercel, eine Zeile `X=` in einer
 * .env) ergab damit ein leeres Modell statt des Standards, und jede Anfrage ging mit
 * `"model": ""` an den Anbieter (Folgesitzung 2026-10-07). Dieselbe Linie wie `isBlank`
 * in env.ts und `llm-failover.ts`, die beide schon trimmen.
 *
 * Auch der Rand zählt: ein beim Einfügen mitgenommener Zeilenumbruch hinter einem
 * Schlüssel macht den Authorization-Header ungültig (fetch wirft, vom Nutzer aus
 * gesehen "Anbieter nicht erreichbar").
 */
export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}
