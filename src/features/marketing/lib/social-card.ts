import { comparisonBySlug } from "./comparisons";
import { taskGuideBySlug } from "./task-guides";
import { docBySlug } from "@/shared/lib/docs-nav";

// Die Vorschaukarte einer Hilfe-, Vergleichs- oder Aufgabenseite (#253): dieselbe Karte wie die der Startseite, aber mit
// dem Titel der Seite. Diese Datei sagt, welche Karten es gibt und was darauf steht; gezeichnet wird sie in
// app/og/[kind]/[slug]/route.tsx.

export type SocialCardKind = "docs" | "vergleich" | "aufgaben";

export type SocialCard = {
  /** Die kleine Zeile über dem Titel. */
  label: string;
  title: string;
};

/**
 * Die Adresse der Karte. Sie endet auf `.png` und das ist Absicht: der Matcher der Middleware lässt Pfade mit
 * Bild-Endung aus, so braucht die Karte weder Sitzung noch Eintrag in app-routes.ts, und Crawler bekommen sie
 * ohne Umweg.
 */
export function socialImageUrl(kind: SocialCardKind, slug: string): string {
  return `/og/${kind}/${slug}.png`;
}

/** Nimmt die Endung `.png` aus dem Pfadsegment, die socialImageUrl() angehängt hat. */
export function slugFromSegment(segment: string): string {
  return segment.replace(/\.png$/, "");
}

export function socialCardFor(kind: string, slug: string): SocialCard | null {
  if (kind === "docs") {
    const doc = docBySlug(slug);
    return doc ? { label: "Hilfe", title: doc.title } : null;
  }
  if (kind === "vergleich") {
    const comparison = comparisonBySlug(slug);
    return comparison ? { label: "Vergleich", title: comparison.question } : null;
  }
  if (kind === "aufgaben") {
    const guide = taskGuideBySlug(slug);
    return guide ? { label: "Aufgabe", title: guide.question } : null;
  }
  return null;
}
