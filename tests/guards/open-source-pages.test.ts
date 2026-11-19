import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLlmsTxt } from "@/app/llms.txt/build-llms-txt";
import { REPO_URL, SELF_HOSTING_DOC_PATH } from "@/features/marketing/lib/open-source";
import { docBySlug, docHref } from "@/shared/lib/docs-nav";

// PromptPrinter ist Open Source und läuft auch ohne Konto (Terminal mit --local) oder selbst betrieben. Dieser Guard
// hält die öffentlichen Stellen fest, an denen das sichtbar ist: die Landing (Karte unter den drei Schritten und der
// Abschluss), die Über-Seite, /terminal, der Hilfe-Artikel und llms.txt. Alle verweisen auf dasselbe Repo
// (features/marketing/lib/open-source.ts), keine nennt Pro oder einen Preis.

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const HOW_IT_WORKS = "src/features/marketing/components/how-it-works.tsx";
const FINAL_CTA = "src/features/marketing/components/final-cta.tsx";
const ABOUT = "src/app/(marketing)/ueber/page.tsx";
const TERMINAL = "src/app/(marketing)/terminal/page.tsx";
const ARTICLE = "src/app/(marketing)/docs/selbst-betreiben/page.tsx";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Open Source auf den öffentlichen Seiten", () => {
  it("das Repo ist das der Web-App", () => {
    expect(REPO_URL).toBe("https://github.com/BajKasum/PromptPrinter");
  });

  it("die Landing sagt es in Finns Worten und verlinkt Repo und Anleitung", () => {
    const howItWorks = read(HOW_IT_WORKS);
    expect(howItWorks).toMatch(/Ich bin Open\s+Source/);
    expect(howItWorks).toContain("href={REPO_URL}");
    expect(howItWorks).toContain("href={SELF_HOSTING_DOC_PATH}");

    const finalCta = read(FINAL_CTA);
    expect(finalCta).toMatch(/mein ganzer Code liegt\s+offen/);
    expect(finalCta).toContain("href={REPO_URL}");
  });

  it("die Über-Seite nennt MIT, das Repo und den Artikel", () => {
    const about = read(ABOUT);
    expect(about).toContain("PromptPrinter ist Open Source");
    expect(about).toContain("MIT-Lizenz");
    expect(about).toContain("href={REPO_URL}");
    expect(about).toContain("href={SELF_HOSTING_DOC_PATH}");
  });

  it("/terminal zeigt den Weg ohne Konto", () => {
    const terminal = read(TERMINAL);
    expect(terminal).toContain("cliLocalSteps()");
    expect(terminal).toContain("Ohne Konto, mit einem freien Modell");
  });

  it("der Hilfe-Artikel existiert, steht in der Navigation und ist das Ziel der Links", () => {
    const doc = docBySlug("selbst-betreiben");
    expect(doc).toBeDefined();
    expect(docHref("selbst-betreiben")).toBe(SELF_HOSTING_DOC_PATH);
    expect(existsSync(join(ROOT, ARTICLE))).toBe(true);
  });

  it("llms.txt nennt Open Source, das Repo und den Artikel", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.com");
    const text = buildLlmsTxt();
    expect(text).toContain("## Open Source");
    expect(text).toContain(REPO_URL);
    expect(text).toContain(`[Selbst betreiben](https://staging.example.com${SELF_HOSTING_DOC_PATH})`);
    expect(text).toContain("--local");
  });

  it("keine dieser Stellen nennt Pro, einen Preis oder ein Bau-Tool", () => {
    // Kein Pro und kein Preis: es gibt nichts zu kaufen. Keine Bau-Tools: Regel für neue Texte in CLAUDE.md.
    for (const path of [HOW_IT_WORKS, FINAL_CTA, ABOUT, TERMINAL, ARTICLE]) {
      const source = read(path);
      expect(source, path).not.toMatch(/\bPro\b|€|\bEUR\b|Kreditkarte/);
      expect(source, path).not.toMatch(/\b(Lovable|Cursor|v0|Bolt|Replit)\b/);
    }
  });
});
