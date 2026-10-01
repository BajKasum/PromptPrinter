import type { MetadataRoute } from "next";
import { COMPARISONS, comparisonHref } from "@/features/marketing/lib/comparisons";
import { DOCS_ORDER, docHref } from "@/shared/lib/docs-nav";
import { siteUrl } from "@/shared/lib/site-url";

// Public, indexable routes only, the app pages live behind auth. The docs
// articles are pulled from the same nav source the section itself renders
// from, so a new article shows up here without a second edit.
//
// BASE used to be the literal string "https://promptprinter.app" — a domain
// that isn't actually assigned yet (CLAUDE.md: appHost in legal.ts is still a
// placeholder pending the hosting decision), so a real crawler following this
// sitemap would have hit a domain nobody serves this app from, or someone
// else's. siteUrl() is the project's own canonical-origin helper (already
// used for auth-redirect links); reusing it here closes the gap between what
// the sitemap claims and where the app actually lives (Security-Audit finding
// L-6). NEXT_PUBLIC_APP_URL is required in production (env.ts's boot check),
// so this always resolves correctly once deployed.
export default function sitemap(): MetadataRoute.Sitemap {
  const BASE = siteUrl();
  const now = new Date();

  const marketing: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    // No /features entry: that route is a redirect to /#funktionen now
    // (next.config.ts), and listing a redirect in a sitemap is a crawl error.
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/docs`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/vergleich`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/ueber`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE}/kontakt`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];

  const docs: MetadataRoute.Sitemap = DOCS_ORDER.map((article) => ({
    url: `${BASE}${docHref(article.slug)}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // Same pattern as the docs: one array (comparisons.ts) drives the pages,
  // the overview and this list.
  const comparisons: MetadataRoute.Sitemap = COMPARISONS.map((comparison) => ({
    url: `${BASE}${comparisonHref(comparison.slug)}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // Legal pages: indexable, but they should never outrank the product.
  const legal: MetadataRoute.Sitemap = [
    "/datenschutz",
    "/cookies",
    "/agb",
    "/nutzungsrichtlinie",
    "/rueckerstattung",
    "/impressum",
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "yearly" as const,
    priority: 0.3,
  }));

  return [...marketing, ...docs, ...comparisons, ...legal];
}
