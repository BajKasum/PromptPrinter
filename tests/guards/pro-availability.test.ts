import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { PRO_AVAILABLE, PRO_UNAVAILABLE_PATH } from "@/shared/lib/pro-availability";

// Pro ist seit 2026-10-17 nicht kaufbar (Vercel Hobby erlaubt keine Zahlungen). Der Schalter steckt
// an EINER Stelle: `LemonCheckoutButton`. Zwei Dinge brechen das still: ein neuer Weg zum Checkout,
// der den Schalter umgeht, und eine Wiederaufnahme, an die sich später niemand mehr erinnert, weil
// Seite, Schalter und Anleitung auseinanderlaufen. Dieser Guard hält beides fest.

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replaceAll("\r\n", "\n");

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

describe("Pro-Schalter", () => {
  it("führt auf eine öffentliche Seite, die es gibt", () => {
    expect(PRO_UNAVAILABLE_PATH).toBe("/pro-bald");
    expect(existsSync(join(ROOT, "src/app/(marketing)/pro-bald/page.tsx"))).toBe(true);
    expect(read("src/server/supabase/middleware.ts")).toContain(`"${PRO_UNAVAILABLE_PATH}"`);
  });

  it("hat eine Anleitung zur Wiederaufnahme, auf die CLAUDE.md verweist", () => {
    const doc = read("docs/PRO-WIEDERAUFNAHME.md");
    expect(doc).toContain("PRO_AVAILABLE = true");
    expect(doc).toContain("Vercel");
    expect(read("CLAUDE.md")).toContain("docs/PRO-WIEDERAUFNAHME.md");
  });

  it("ist gerade aus, und dann steht es in CLAUDE.md so", () => {
    // Beim Wiederaufnehmen ändert sich dieser Test mit dem Schalter (Schritt 4 der Anleitung).
    expect(PRO_AVAILABLE).toBe(false);
    expect(read("CLAUDE.md")).toMatch(/Pro ist (abgeschaltet|nicht kaufbar)/);
  });

  it("nur LemonCheckoutButton baut die Checkout-Adresse, kein Weg am Schalter vorbei", () => {
    const users = sourceFiles("src")
      .filter((file) => /buildCheckoutUrl|checkoutUrlFromEnv/.test(read(file)))
      .map((file) => relative(ROOT, file).replaceAll("\\", "/"))
      .sort();
    expect(users).toEqual(["src/shared/lib/lemon-squeezy.ts", "src/shared/ui/lemon-checkout-button.tsx"]);
  });
});
