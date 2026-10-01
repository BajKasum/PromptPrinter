import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Hält fest, was jede öffentliche Seite für Suchmaschinen mitbringen muss.
//
// ─── Warum ein Guard ───────────────────────────────────────────────────────
// Next merged `alternates` nicht pro Feld: eine Seite ohne eigenes Canonical
// erbt das "/" aus dem Root-Layout und behauptet damit still, die Startseite
// zu sein. Genau das ist zweimal passiert, ohne dass etwas kaputt aussah:
// zuerst auf jeder Unterseite (behoben am 28.09.2026), dann blieben /login,
// /signup und die Passwort-Seiten übrig (gefunden am 01.10.2026 per curl
// gegen die Live-Seite). Der Fehler ist im Browser unsichtbar, deshalb steht
// die Regel hier.

const APP_DIR = join(process.cwd(), "src", "app");

function pagesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return pagesIn(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

function label(file: string): string {
  return relative(process.cwd(), file).replace(/\\/g, "/");
}

const publicPages = [
  ...pagesIn(join(APP_DIR, "(marketing)")),
  ...pagesIn(join(APP_DIR, "(auth)")),
];

// Die Startseite ist die einzige Seite, für die das geerbte "/" stimmt.
const HOME = join(APP_DIR, "(marketing)", "page.tsx");

describe("SEO-Metadaten der öffentlichen Seiten", () => {
  it("findet die öffentlichen Seiten überhaupt", () => {
    expect(publicPages.length).toBeGreaterThan(15);
    expect(publicPages).toContain(HOME);
  });

  it("gibt jeder Seite ausser der Startseite ein eigenes Canonical", () => {
    const missing = publicPages
      .filter((file) => file !== HOME)
      .filter((file) => !/canonical\s*:/.test(readFileSync(file, "utf8")))
      .map(label);

    expect(
      missing,
      `Diese Seiten setzen kein eigenes alternates.canonical und erben damit "/" ` +
        `aus dem Root-Layout:\n${missing.join("\n")}`
    ).toEqual([]);
  });

  it("hält die Formularseiten aus dem Suchindex", () => {
    const authLayout = readFileSync(join(APP_DIR, "(auth)", "layout.tsx"), "utf8");
    expect(authLayout).toMatch(/robots\s*:\s*\{\s*index\s*:\s*false\s*,\s*follow\s*:\s*true\s*\}/);
  });
});
