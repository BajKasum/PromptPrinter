import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import AufgabenPage from "./page";
import TaskGuidePage, { generateStaticParams } from "./[slug]/page";
import { TASK_GUIDES, taskGuideHref } from "@/features/marketing/lib/task-guides";

// Die Übersicht und die Seiten unter /aufgaben (#254). Der Test liest, was auf der Seite STEHT: ein Beispiel ohne
// Kennzeichnung oder eine Überschrift, die aus der Seite verschwindet, fiele sonst nur beim Lesen im Browser auf.

describe("Seiten unter /aufgaben", () => {
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

  it("die Übersicht hat genau eine Hauptüberschrift und verlinkt jede Aufgabe", () => {
    render(<AufgabenPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const links = screen.getAllByRole("link");
    for (const guide of TASK_GUIDES) {
      const link = links.find((candidate) => candidate.getAttribute("href") === taskGuideHref(guide.slug));
      expect(link, guide.slug).toBeDefined();
      expect(link).toHaveTextContent(guide.question);
    }
  });

  it("die Übersicht sagt, woher die Beispiele kommen, und behauptet keine Messwerte", () => {
    const { container } = render(<AufgabenPage />);
    const text = container.textContent ?? "";
    expect(text).toContain("von Hand nach den Regeln geschrieben");
    expect(text).toContain("stammen nicht aus echten Gesprächen");
    expect(text).not.toMatch(/\d+\s?%/);
  });

  it("erzeugt für jede Aufgabe eine Seite", () => {
    expect(generateStaticParams()).toEqual(TASK_GUIDES.map((guide) => ({ slug: guide.slug })));
  });

  for (const guide of TASK_GUIDES) {
    describe(guide.label, () => {
      it("hat eine Hauptüberschrift mit der Frage und die Antwort direkt darunter", async () => {
        render(await TaskGuidePage({ params: Promise.resolve({ slug: guide.slug }) }));
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(guide.question);
        expect(screen.getByText(guide.answer)).toBeInTheDocument();
      });

      it("stellt jede Zwischenüberschrift als Frage", async () => {
        render(await TaskGuidePage({ params: Promise.resolve({ slug: guide.slug }) }));
        const h2 = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent ?? "");
        const own = h2.filter((text) => !/^(Aus der Hilfe|Weitere Aufgaben)$/.test(text));
        expect(own.length).toBeGreaterThanOrEqual(3);
        for (const text of own) expect(text).toMatch(/\?$/);
      });

      it("kennzeichnet das Beispiel als Beispiel und zeigt den Prompt im Codeblock", async () => {
        const { container } = render(await TaskGuidePage({ params: Promise.resolve({ slug: guide.slug }) }));
        const example = within(screen.getByTestId("task-example"));
        expect(example.getByText("Beispiel")).toBeInTheDocument();
        expect(example.getByText(/stammt nicht aus einem echten Gespräch/)).toBeInTheDocument();
        expect(container.querySelector("pre code")?.textContent).toBe(guide.example.prompt);
      });

      it("sagt, wann man das nicht braucht, und führt die FAQ-Daten mit derselben Frage", async () => {
        const { container } = render(await TaskGuidePage({ params: Promise.resolve({ slug: guide.slug }) }));
        expect(screen.getByRole("heading", { level: 2, name: "Wann brauchst du das nicht?" })).toBeInTheDocument();
        const faq = [...container.querySelectorAll('script[type="application/ld+json"]')]
          .map((script) => JSON.parse(script.textContent ?? "{}"))
          .find((data) => data["@type"] === "FAQPage");
        expect(faq.mainEntity.map((item: { name: string }) => item.name)).toEqual([
          guide.question,
          "Wann brauchst du das nicht?",
        ]);
      });
    });
  }

  it("antwortet auf eine unbekannte Aufgabe mit einem 404", async () => {
    await expect(TaskGuidePage({ params: Promise.resolve({ slug: "gibt-es-nicht" }) })).rejects.toThrow();
  });
});
