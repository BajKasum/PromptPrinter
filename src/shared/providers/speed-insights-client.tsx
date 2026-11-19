"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { scrubSpeedInsightsEvent } from "@/shared/lib/speed-insights-event";

/**
 * Der Client-Teil von Vercel Speed Insights. Ob er überhaupt gerendert wird, entscheidet `SiteSpeedInsights`
 * (site-speed-insights.tsx) auf dem Server.
 *
 * Eigene Client-Komponente, weil `beforeSend` eine Funktion ist und eine Funktion nicht als Prop von einer
 * Server- in eine Client-Komponente kommt: das Kürzen der Adressen (`scrubSpeedInsightsEvent`) muss hier sitzen.
 */
export function SpeedInsightsClient() {
  return <SpeedInsights beforeSend={scrubSpeedInsightsEvent} />;
}
