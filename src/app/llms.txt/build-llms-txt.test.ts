import { afterEach, describe, expect, it, vi } from "vitest";
import { COMPARISONS } from "@/features/marketing/lib/comparisons";
import { REPO_URL } from "@/features/marketing/lib/open-source";
import { TASK_GUIDES } from "@/features/marketing/lib/task-guides";
import { DOCS_ORDER } from "@/shared/lib/docs-nav";
import { FREE_TRIAL } from "@/shared/lib/plans";
import { buildLlmsTxt, numberWord } from "./build-llms-txt";

// Same drift guard as robots.test.ts / sitemap.test.ts: every URL in here
// must come from the configured app origin, never a hardcoded domain this
// deployment doesn't own.
describe("llms.txt", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds every link from the configured app origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    const text = buildLlmsTxt();
    const links = [...text.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]);

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.startsWith("https://staging.example.com/")).toBe(true);
    }
  });

  it("never hardcodes a domain the deployment doesn't own", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    expect(buildLlmsTxt()).not.toContain("promptprinter.app");
  });

  it("lists every docs article", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    const text = buildLlmsTxt();
    for (const doc of DOCS_ORDER) expect(text).toContain(`/docs/${doc.slug}`);
  });

  // PromptPrinter kostet nichts. Antwortmaschinen lesen diese Datei: kein Preis, kein Plan, den man kaufen müsste,
  // und keine Seite, die nur noch umleitet.
  it("sagt, dass es kostenlos und Open Source ist, und nennt keinen Preis", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    const text = buildLlmsTxt();
    const costs = text.split("## Kosten")[1]?.split("\n## ")[0] ?? "";

    expect(costs).toContain("kostenlos und Open Source");
    expect(costs).toContain(`ersten ${numberWord(FREE_TRIAL.prompts).toLowerCase()} Prompts`);
    // Repo und Lizenz stehen einmal, im Abschnitt "Open Source"; "Kosten" verweist dorthin.
    const openSource = text.split("## Open Source")[1]?.split("\n## ")[0] ?? "";
    expect(openSource).toContain(REPO_URL);
    expect(openSource).toContain("MIT-Lizenz");
    expect(costs).toContain('Abschnitt "Open Source"');
    expect(text).not.toMatch(/€|\bPro\b/);
    expect(text).toContain("](https://staging.example.com/open-source)");
    for (const gone of ["/pricing", "/pro-bald", "/rueckerstattung"]) expect(text).not.toContain(gone);
  });

  // #252: Antwortmaschinen sollen die Sprachen der App kennen, ohne dass die Seiten übersetzt sind.
  it("nennt die fünf Sprachen der App auf Deutsch und in einer englischen Zusammenfassung", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    const text = buildLlmsTxt();

    expect(text).toContain("Deutsch, Englisch, Französisch, Italienisch und Spanisch");
    const english = text.split("## English")[1];
    expect(english).toBeDefined();
    expect(english).toContain("German, English, French, Italian and Spanish");
    expect(english).toContain("public website is in German only");
  });

  it("lists the task pages with their question", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    const text = buildLlmsTxt();

    expect(text).toContain("## Aufgaben");
    expect(text).toContain("](https://staging.example.com/aufgaben)");
    for (const guide of TASK_GUIDES) {
      expect(text).toContain(`[${guide.question}](https://staging.example.com/aufgaben/${guide.slug})`);
    }
  });

  it("lists the comparison pages with their question", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    const text = buildLlmsTxt();

    expect(text).toContain("## Vergleiche");
    for (const comparison of COMPARISONS) {
      expect(text).toContain(
        `[${comparison.question}](https://staging.example.com/vergleich/${comparison.slug})`
      );
    }
  });
});

describe("Zahlwörter in llms.txt", () => {
  it("folgen der Länge der Listen", () => {
    const text = buildLlmsTxt();
    expect(text).toContain(`${numberWord(COMPARISONS.length)} Wege zum Prompt im Vergleich`);
    expect(text).toContain(`: ${numberWord(TASK_GUIDES.length)} Aufgaben, jeweils mit`);
    expect(numberWord(4)).toBe("Vier");
    expect(numberWord(99)).toBe("99");
  });
});
