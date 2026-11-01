import type { MetadataRoute } from "next";
import { COMPARISONS, COMPARISONS_UPDATED, comparisonHref } from "@/features/marketing/lib/comparisons";
import { DOCS_ORDER, docHref } from "@/shared/lib/docs-nav";
import { isoFromGermanDate } from "@/shared/lib/german-date";
import { LEGAL } from "@/shared/lib/legal";
import { siteUrl } from "@/shared/lib/site-url";

// Nur öffentliche, indexierbare Routen, die App-Seiten liegen hinter dem Login. Hilfe und Vergleiche kommen aus
// derselben Quelle wie die Seiten selbst, ein neuer Artikel steht hier ohne zweite Änderung.
//
// `lastModified` ist das Datum, das die Seite selbst zeigt (Byline, `dateModified`): Hilfe-Artikel `updated`,
// Vergleiche `COMPARISONS_UPDATED`, Rechtstexte `LEGAL.lastUpdated`. Wo es kein gepflegtes Datum gibt, fehlt das
// Feld: kein Datum ist besser als ein falsches, und die Buildzeit ist keine Änderung (#251).

export default function sitemap(): MetadataRoute.Sitemap {
  const BASE = siteUrl();
  const docsUpdated = DOCS_ORDER.map((article) => article.updated).sort().at(-1);
  const legalUpdated = isoFromGermanDate(LEGAL.lastUpdated);

  const marketing: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    // Kein /features: die Route leitet auf /#funktionen um (next.config.ts), und ein Redirect in der Sitemap ist
    // ein Crawl-Fehler.
    { url: `${BASE}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/skill`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/docs`, lastModified: docsUpdated, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/vergleich`, lastModified: COMPARISONS_UPDATED, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/ueber`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE}/kontakt`, changeFrequency: "yearly", priority: 0.5 },
  ];

  const docs: MetadataRoute.Sitemap = DOCS_ORDER.map((article) => ({
    url: `${BASE}${docHref(article.slug)}`,
    lastModified: article.updated,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const comparisons: MetadataRoute.Sitemap = COMPARISONS.map((comparison) => ({
    url: `${BASE}${comparisonHref(comparison.slug)}`,
    lastModified: COMPARISONS_UPDATED,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // Rechtstexte: indexierbar, aber sie sollen das Produkt nie überholen.
  const legal: MetadataRoute.Sitemap = [
    "/datenschutz",
    "/cookies",
    "/agb",
    "/nutzungsrichtlinie",
    "/rueckerstattung",
    "/impressum",
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: legalUpdated,
    changeFrequency: "yearly" as const,
    priority: 0.3,
  }));

  return [...marketing, ...docs, ...comparisons, ...legal];
}
