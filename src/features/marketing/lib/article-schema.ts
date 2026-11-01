import { siteUrl } from "@/shared/lib/site-url";
import { AUTHOR_PATH } from "./entity-ids";
import { organizationRef, personRef } from "./site-schema";

export { AUTHOR_PATH };

/** "2026-10-01" wird zu "1. Oktober 2026". UTC, damit der Tag nicht kippt. */
export function formatLongDate(isoDate: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/**
 * Article-Markup für eine Seite mit Autorenzeile (Hilfe-Artikel, Vergleiche).
 *
 * Sagt Suchmaschinen und Antwortmaschinen, wer den Text geschrieben hat und
 * von wann er ist. Der Autor ist derselbe Mensch wie im Impressum (LEGAL), das
 * Datum dasselbe wie in der sichtbaren Autorenzeile: was hier steht, muss auf
 * der Seite zu lesen sein, sonst ist es Structured-Data-Missbrauch. Autor und
 * Herausgeber tragen die @id der Knoten aus site-schema.ts, nicht nur ihren Namen.
 */
export function articleJsonLd({
  type = "Article",
  headline,
  description,
  path,
  published,
  updated,
}: {
  type?: "Article" | "TechArticle";
  headline: string;
  description: string;
  path: string;
  /** ISO-Datum der Erstveröffentlichung. */
  published: string;
  /** ISO-Datum der letzten inhaltlichen Änderung. */
  updated: string;
}): Record<string, unknown> {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": type,
    headline,
    description,
    inLanguage: "de",
    datePublished: published,
    dateModified: updated,
    mainEntityOfPage: `${base}${path}`,
    author: personRef(),
    publisher: organizationRef(),
  };
}
