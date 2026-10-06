"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { scrubSpeedInsightsEvent } from "@/shared/lib/speed-insights-event";

/**
 * Vercel Speed Insights: misst die Ladezeiten (Web Vitals) echter Besucher.
 *
 * Eigene Komponente statt `<SpeedInsights />` direkt im Root-Layout, aus zwei
 * Gründen:
 *
 * - `beforeSend` ist eine Funktion, und eine Funktion kommt nicht als Prop von
 *   einer Server- in eine Client-Komponente. Das Root-Layout ist ein Server
 *   Component, das Kürzen der Adressen (`scrubSpeedInsightsEvent`) muss also
 *   hier im Client sitzen.
 * - Nur im Produktions-Build. In der Entwicklung lädt das Paket ein
 *   Debug-Skript von `va.vercel-scripts.com`, und das blockiert unsere CSP zu
 *   Recht (`script-src` kennt keinen fremden Host). Statt dafür die Policy zu
 *   lockern, misst die Entwicklung gar nicht. Vorschau-Deployments auf Vercel
 *   sind Produktions-Builds, die Komponente ist dort also eingebunden.
 *
 * Kein Eintrag in der CSP nötig: das Skript kommt von unserer eigenen Adresse
 * (`/_vercel/speed-insights/…`, `'self'`), die Messwerte gehen an denselben
 * Ursprung zurück (`connect-src 'self'`). Wer `scriptSrc` oder `endpoint` auf
 * einen fremden Host stellt, muss `csp.ts` mitziehen.
 *
 * Eine Client-Komponente im Root-Layout macht die öffentlichen Seiten nicht
 * dynamisch (nur `headers()`/`cookies()` täten das), siehe
 * tests/guards/static-public-pages.test.ts.
 */
export function SiteSpeedInsights() {
  if (process.env.NODE_ENV !== "production") return null;
  return <SpeedInsights beforeSend={scrubSpeedInsightsEvent} />;
}
