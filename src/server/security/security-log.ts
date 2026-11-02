import "server-only";

import { logEvent, redactContext, type LogContext } from "@/shared/lib/observability";

// Sicherheitsrelevante Vorgänge als strukturierte Logzeile: Anmelden, Registrieren, Reset, Absagen. Damit lässt sich
// ein Angriffsmuster sehen und ein Vorfall rekonstruieren, solange das Log reicht. Vercel Hobby hält es eine Stunde
// (docs/SETUP.md, "Sicherheitsprotokoll"). Was länger bleiben muss, schreibt server/security/security-events.ts.
//
// Nur die Kennung des Kontos, nie eine Adresse, ein Key oder Inhalt. redactContext prüft die Namen der Felder; hier
// kommen die Werte dazu, denn ein harmlos benanntes Feld kann eine Fehlermeldung mit einer Adresse tragen.

const ADDRESS_IN_TEXT = /\S+@\S+/g;
const KEY_IN_TEXT = /\b(?:sk-[\w-]{6,}|AIza[\w-]{6,}|eyJ[\w-]{6,}\.[\w-]+\.[\w-]+)/g;

function scrubValues(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.replace(ADDRESS_IN_TEXT, "[adresse]").replace(KEY_IN_TEXT, "[schluessel]")];
      }
      if (value && typeof value === "object") return [key, scrubValues(value as LogContext)];
      return [key, value];
    })
  );
}

/** Was von einem Kontext ins Protokoll darf: Felder geschwärzt, Adressen und Keys aus den Werten entfernt. */
export function safeSecurityContext(context: LogContext): LogContext {
  return scrubValues(redactContext(context));
}

/** Ein Vorgang, der nur ins Log gehört. */
export function logSecurityEvent(event: string, context: LogContext = {}): void {
  logEvent(event, safeSecurityContext(context));
}

/**
 * Absagen kommen in Wellen: ein Crawler ohne Sitzung, ein Skript, das fremde Kennungen durchprobiert. Jede zehnte
 * reicht, um das Muster zu sehen, und `sampleRate` in der Zeile erlaubt die Hochrechnung.
 */
export const DENIAL_SAMPLE_RATE = 0.1;

function logSampled(event: string, context: LogContext, random: () => number): void {
  if (random() >= DENIAL_SAMPLE_RATE) return;
  logSecurityEvent(event, { ...context, sampleRate: DENIAL_SAMPLE_RATE });
}

/**
 * Hält eine abgelehnte Anfrage fest (401, 403, 404 auf eine fremde Kennung) und gibt die Antwort unverändert zurück:
 * `return denied("projects", problem(401, …))`. `context` trägt, was die Route schon weiss, etwa die Kennung des Kontos.
 */
export function denied<T extends Response>(
  route: string,
  response: T,
  context: LogContext = {},
  random: () => number = Math.random
): T {
  logSampled("access.denied", { route, status: response.status, ...context }, random);
  return response;
}

/**
 * Hält eine Absage des Ratenlimits fest. Der Schlüssel ist `<bereich>:u:<konto>` oder `<bereich>:ip:<adresse>`
 * (rateLimitKey): die Adresse bleibt draussen, die Kennung eines angemeldeten Kontos kommt mit.
 */
export function logRateLimited(key: string, random: () => number = Math.random): void {
  const [scope, kind, id] = key.split(":");
  logSampled("rate_limit.rejected", { scope, ...(kind === "u" && id ? { userId: id } : {}) }, random);
}
