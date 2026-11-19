import { SpeedInsightsClient } from "./speed-insights-client";

/**
 * Vercel Speed Insights: misst die Ladezeiten (Web Vitals) echter Besucher, nur in einem Produktions-Build auf
 * Vercel (`measuresSpeed`).
 *
 * - **Nur auf Vercel.** Das Skript liegt unter `/_vercel/speed-insights/…`, und diesen Pfad stellt nur Vercel
 *   bereit. Auf einer eigenen Installation (`npm start`, das Docker-Image, docs/SETUP.md "Selbst betreiben") wäre
 *   er je Seite ein 404 mit einer Meldung in der Konsole, gemessen würde dort ohnehin nichts. Vercel setzt
 *   `VERCEL=1` beim Bauen und zur Laufzeit; dieselbe Variable trennt in server/self-hosted.ts und
 *   server/security/rate-limit.ts Vercel vom Einzelbetrieb.
 * - **Nur im Produktions-Build.** In der Entwicklung lädt das Paket ein Debug-Skript von `va.vercel-scripts.com`,
 *   und das blockiert unsere CSP zu Recht (`script-src` kennt keinen fremden Host). Vorschau-Deployments auf Vercel
 *   sind Produktions-Builds, die Messung ist dort also eingebunden.
 *
 * Die Entscheidung fällt hier, in einer Server-Komponente: `process.env.VERCEL` kommt nicht in den Browser (nur
 * `NEXT_PUBLIC_*` wird eingebacken). Öffentliche Seiten rendert der Build, also gilt dort die Umgebung beim Bauen,
 * die App rendert zur Laufzeit; auf Vercel ist `VERCEL` in beiden gesetzt, auf einer eigenen Installation in
 * keiner. Das Lesen einer Umgebungsvariable macht eine Seite nicht dynamisch (nur `headers()`/`cookies()` täten
 * das), siehe tests/guards/static-public-pages.test.ts.
 *
 * Kein Eintrag in der CSP nötig: das Skript kommt von unserer eigenen Adresse (`'self'`), die Messwerte gehen an
 * denselben Ursprung zurück (`connect-src 'self'`). Wer `scriptSrc` oder `endpoint` auf einen fremden Host stellt,
 * muss `csp.ts` mitziehen.
 */
export function SiteSpeedInsights() {
  return measuresSpeed() ? <SpeedInsightsClient /> : null;
}

/** Misst diese Umgebung? Nur ein Produktions-Build auf Vercel. */
export function measuresSpeed(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === "production" && Boolean(env.VERCEL?.trim());
}
