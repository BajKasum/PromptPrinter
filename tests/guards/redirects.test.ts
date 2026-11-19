import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPARISONS } from "@/features/marketing/lib/comparisons";
import nextConfig from "../../next.config";

// Der dritte Vergleich hieß bis zum 11.10.2026 "direkt-im-bau-tool-prompten" und heißt seit der Neuausrichtung
// "direkt-in-die-ki-tippen". Die alte Adresse war öffentlich und in der Sitemap: ohne Umleitung wäre sie ein 404,
// und jeder Link darauf (Suchmaschinen, geteilte Links) liefe ins Leere.

const COMPARISON_PREFIX = "/vergleich/";

async function redirects() {
  return (await nextConfig.redirects?.()) ?? [];
}

describe("Umleitungen in next.config.ts", () => {
  it("führt die alte Vergleichsadresse dauerhaft auf den umbenannten Vergleich", async () => {
    const entry = (await redirects()).find(
      (redirect) => redirect.source === `${COMPARISON_PREFIX}direkt-im-bau-tool-prompten`
    );

    expect(entry).toMatchObject({
      destination: `${COMPARISON_PREFIX}direkt-in-die-ki-tippen`,
      permanent: true,
    });
  });

  it("jede Umleitung auf einen Vergleich zeigt auf einen, den es gibt", async () => {
    const slugs = COMPARISONS.map((comparison) => comparison.slug);
    const toComparisons = (await redirects()).filter((redirect) =>
      redirect.destination.startsWith(COMPARISON_PREFIX)
    );

    expect(toComparisons.length).toBeGreaterThan(0);
    for (const redirect of toComparisons) {
      expect(slugs, redirect.destination).toContain(redirect.destination.slice(COMPARISON_PREFIX.length));
    }
  });

  it("keine Umleitung beginnt bei einem Vergleich, der noch existiert (sonst wäre er nicht mehr erreichbar)", async () => {
    const slugs = new Set(COMPARISONS.map((comparison) => comparison.slug));

    for (const redirect of await redirects()) {
      if (!redirect.source.startsWith(COMPARISON_PREFIX)) continue;
      expect(slugs.has(redirect.source.slice(COMPARISON_PREFIX.length)), redirect.source).toBe(false);
    }
  });
});

// PromptPrinter kostet nichts: Preisseite, Pro-Seite, Rückerstattung und die Abrechnung der App gibt es nicht mehr.
// Ihre Adressen waren öffentlich oder in Mails und Lesezeichen; ohne Umleitung wären sie ein 404.
describe("Umleitungen der Seiten ohne Bezahlung", () => {
  it.each([
    ["/pricing", "/open-source"],
    ["/pro-bald", "/open-source"],
    ["/rueckerstattung", "/agb"],
    ["/billing", "/usage"],
    ["/billing/:path*", "/usage"],
    ["/plans", "/usage"],
    ["/plans/:path*", "/usage"],
  ])("leitet %s dauerhaft auf %s", async (source, destination) => {
    const entry = (await redirects()).find((redirect) => redirect.source === source);
    expect(entry, source).toMatchObject({ destination, permanent: true });
  });

  it("zeigt auf Seiten, die es gibt", () => {
    for (const page of ["(marketing)/open-source", "(marketing)/(legal)/agb", "(app)/usage"]) {
      expect(existsSync(join(process.cwd(), "src", "app", page, "page.tsx")), page).toBe(true);
    }
  });

  it("lässt keine umgeleitete Seite als Ordner stehen (sie wäre nicht mehr erreichbar)", () => {
    for (const page of ["(marketing)/pricing", "(marketing)/pro-bald", "(marketing)/(legal)/rueckerstattung", "(app)/billing", "(app)/plans"]) {
      expect(existsSync(join(process.cwd(), "src", "app", page)), page).toBe(false);
    }
  });
});
