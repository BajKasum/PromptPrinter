import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "@/shared/i18n/locales";
import { messagesFor } from "@/server/i18n";
import { de } from "@/shared/i18n/messages/de";
import { PLANS, localizePlans } from "@/shared/lib/pricing";

// Was TypeScript an den Wörterbüchern NICHT prüfen kann.
//
// Der Typ `Messages` erzwingt, dass jede Sprache jeden Schlüssel hat. Er sagt
// aber nichts über den Inhalt: eine Übersetzung, die "{count}" vergisst oder
// "{name}" zu "{nom}" übersetzt, kompiliert, und auf dem Bildschirm steht
// dann eine leere Stelle oder ein roher Platzhalter. Das prüft dieser Guard
// für jede Sprache in LOCALES gegen Deutsch.

type Tree = { [key: string]: string | string[] | Tree };

function leaves(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") return [[path, value]] as [string, string][];
    if (Array.isArray(value)) return value.map((v, i) => [`${path}[${i}]`, v] as [string, string]);
    return leaves(value, path);
  });
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("i18n-Wörterbücher", () => {
  const reference = new Map(leaves(de as unknown as Tree));

  it.each(LOCALES.filter((l) => l !== "de"))(
    "%s nutzt in jedem Text dieselben Platzhalter wie Deutsch",
    (locale) => {
      const wrong: string[] = [];
      for (const [path, text] of leaves(messagesFor(locale) as unknown as Tree)) {
        const expected = reference.get(path);
        if (expected === undefined) continue;
        if (placeholders(text).join() !== placeholders(expected).join()) {
          wrong.push(`${path}: "${text}" (erwartet: ${placeholders(expected).join(", ") || "keine"})`);
        }
      }
      expect(wrong, "Platzhalter weichen vom deutschen Original ab").toEqual([]);
    }
  );

  it.each(LOCALES.filter((l) => l !== "de"))("%s hat keinen leeren Text", (locale) => {
    const empty = leaves(messagesFor(locale) as unknown as Tree)
      .filter(([, text]) => text.trim().length === 0)
      .map(([path]) => path);
    expect(empty).toEqual([]);
  });

  it("die deutschen Plan-Texte der App decken sich mit der Preisseite", () => {
    // /pricing liest PLANS, die App liest t.planCopy. Driftet eins davon,
    // verspricht die App etwas anderes als die öffentliche Seite.
    const app = localizePlans(de, "de");
    for (const plan of PLANS) {
      const localized = app.find((p) => p.name === plan.name)!;
      expect(localized.features).toEqual(plan.features);
      expect(localized.description).toBe(plan.description);
      expect(localized.cadence).toBe(plan.cadence);
      expect(localized.price.replace(/ /g, " ")).toBe(plan.price);
    }
  });

  it("nur der Server lädt die Wörterbücher der anderen Sprachen", () => {
    // Eine Client-Komponente, die ein fremdes Wörterbuch importiert, zieht es
    // für jeden Nutzer ins Bundle. Der Weg in den Browser ist der
    // I18nProvider, der nur die aktive Sprache bekommt.
    const src = join(process.cwd(), "src");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          const text = readFileSync(full, "utf8");
          const importsForeign = /from "@\/shared\/i18n\/messages\/(?!de")[a-z]{2}"/.test(text);
          if (importsForeign && !full.includes(join("src", "shared", "i18n", "messages")) && !full.endsWith(join("src", "server", "i18n.ts"))) {
            offenders.push(relative(process.cwd(), full));
          }
        }
      }
    };
    walk(src);
    expect(offenders).toEqual([]);
  });
});
