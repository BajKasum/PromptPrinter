import type { Metadata } from "next";
import { DOCS_PUBLISHED, docHref, type DocArticle } from "@/shared/lib/docs-nav";
import { pageMetadata } from "@/shared/lib/page-metadata";
import { siteUrl } from "@/shared/lib/site-url";
import { AUTHOR_PATH } from "./entity-ids";
import { COMPARISONS_UPDATED, comparisonHref, type Comparison } from "./comparisons";
import { socialImageUrl } from "./social-card";

// Die Metadaten der Seiten mit Autorenzeile (Hilfe-Artikel, Vergleiche): eigene Vorschaukarte mit dem Titel der
// Seite und `og:type` "article" mit denselben Daten, die die Autorenzeile und das JSON-LD (article-schema.ts) nennen.

/** Metadaten eines Hilfe-Artikels; `docs-nav.ts` ist die Quelle von Titel, Zusammenfassung und Datum. */
export function docMetadata(doc: DocArticle): Metadata {
  return pageMetadata({
    title: doc.title,
    description: doc.summary,
    path: docHref(doc.slug),
    image: { url: socialImageUrl("docs", doc.slug), alt: `${doc.title}, Hilfe von PromptPrinter` },
    article: {
      publishedTime: DOCS_PUBLISHED,
      modifiedTime: doc.updated,
      authors: [siteUrl(AUTHOR_PATH)],
    },
  });
}

/** Metadaten eines Vergleichs. Jede Frage nennt PromptPrinter schon selbst, der Titel steht allein. */
export function comparisonMetadata(comparison: Comparison): Metadata {
  return pageMetadata({
    title: comparison.question,
    description: comparison.summary,
    path: comparisonHref(comparison.slug),
    titleStandsAlone: true,
    image: { url: socialImageUrl("vergleich", comparison.slug), alt: `${comparison.question}, Vergleich von PromptPrinter` },
    article: {
      publishedTime: comparison.published,
      modifiedTime: COMPARISONS_UPDATED,
      authors: [siteUrl(AUTHOR_PATH)],
    },
  });
}
