import type { MetadataRoute } from "next";
import { DOCS_ORDER, docHref } from "@/lib/docs-nav";

const BASE = "https://promptprinter.app";

// Public, indexable routes only, the app pages live behind auth. The docs
// articles are pulled from the same nav source the section itself renders
// from, so a new article shows up here without a second edit.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const marketing: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/features`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/docs`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/ueber`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE}/kontakt`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];

  const docs: MetadataRoute.Sitemap = DOCS_ORDER.map((article) => ({
    url: `${BASE}${docHref(article.slug)}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // Legal pages: indexable, but they should never outrank the product.
  const legal: MetadataRoute.Sitemap = [
    "/datenschutz",
    "/agb",
    "/rueckerstattung",
    "/impressum",
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "yearly" as const,
    priority: 0.3,
  }));

  return [...marketing, ...docs, ...legal];
}
