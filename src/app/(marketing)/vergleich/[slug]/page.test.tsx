import { render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import ComparisonPage, { generateStaticParams } from "./page";
import { COMPARISONS, comparisonHref } from "@/features/marketing/lib/comparisons";

// Eine Vergleichsseite, wie sie auf dem Bildschirm und für Suchmaschinen steht: Zurück-Link, Frage als h1,
// strukturierte Daten und "Weiterlesen".

describe("Seiten unter /vergleich/[slug]", () => {
  // FadeIn wartet mit whileInView auf einen IntersectionObserver, den jsdom nicht kennt.
  beforeAll(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      }
    );
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("erzeugt für jeden Vergleich eine Seite", () => {
    expect(generateStaticParams()).toEqual(COMPARISONS.map((comparison) => ({ slug: comparison.slug })));
  });

  for (const comparison of COMPARISONS) {
    describe(comparison.label, () => {
      const renderPage = async () =>
        render(await ComparisonPage({ params: Promise.resolve({ slug: comparison.slug }) }));

      it("führt zurück zur Übersicht und beantwortet die Frage unter der h1", async () => {
        await renderPage();
        expect(screen.getByRole("link", { name: "← Alle Vergleiche" })).toHaveAttribute("href", "/vergleich");
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(comparison.question);
        expect(screen.getByText(comparison.answer)).toBeInTheDocument();
      });

      it("führt Breadcrumb, Artikel und FAQ in den strukturierten Daten", async () => {
        const { container } = await renderPage();
        const data = [...container.querySelectorAll('script[type="application/ld+json"]')].map((script) =>
          JSON.parse(script.textContent ?? "{}")
        );
        expect(data.map((entry) => entry["@type"])).toEqual(["BreadcrumbList", "Article", "FAQPage"]);
        const [breadcrumb, article, faq] = data;
        expect(breadcrumb.itemListElement.map((item: { name: string }) => item.name)).toEqual([
          "PromptPrinter",
          "Vergleich",
          comparison.label,
        ]);
        expect(breadcrumb.itemListElement[1].item).toMatch(/\/vergleich$/);
        expect(breadcrumb.itemListElement[2].item.endsWith(comparisonHref(comparison.slug))).toBe(true);
        expect(article.headline).toBe(comparison.question);
        expect(faq.mainEntity).toEqual(
          comparison.sections.map((section) => ({
            "@type": "Question",
            name: section.question,
            acceptedAnswer: { "@type": "Answer", text: section.paragraphs.join(" ") },
          }))
        );
      });

      it("verlinkt unter Weiterlesen die Hilfe und jeden anderen Vergleich, nicht sich selbst", async () => {
        await renderPage();
        const nav = within(screen.getByRole("navigation", { name: "Weiterlesen" }));
        expect(nav.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
          "Aus der Hilfe",
          "Weitere Vergleiche",
        ]);
        expect(nav.getAllByRole("link").map((a) => [a.getAttribute("href"), a.textContent])).toEqual([
          ...comparison.related.map((link) => [link.href, link.label]),
          ...COMPARISONS.filter((other) => other.slug !== comparison.slug).map((other) => [
            comparisonHref(other.slug),
            other.question,
          ]),
        ]);
      });

      it("bietet vor dem Weiterlesen Anmelden und Open Source an", async () => {
        await renderPage();
        // Die Hilfe-Liste darf dieselbe Seite nennen: gemeint sind die beiden Knöpfe ausserhalb der Navigation.
        const button = (name: string) => screen.getAllByRole("link", { name }).filter((a) => !a.closest("nav"));
        expect(button("Ausprobieren").map((a) => a.getAttribute("href"))).toEqual(["/signup"]);
        expect(button("Kostenlos und Open Source").map((a) => a.getAttribute("href"))).toEqual(["/open-source"]);
      });
    });
  }

  it("antwortet auf einen unbekannten Vergleich mit einem 404", async () => {
    await expect(ComparisonPage({ params: Promise.resolve({ slug: "gibt-es-nicht" }) })).rejects.toThrow();
  });
});
