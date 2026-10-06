import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Kein Verweis in den Doku-Dateien läuft ins Leere (Betriebs-Audit M7).
//
// CLAUDE.md wurde am 2026-10-06 von 1739 auf rund 420 Zeilen gekürzt, der Verlauf
// zog nach docs/CHANGELOG-2026.md. Andere Dateien verweisen auf Abschnitte
// ("Begründung steht in CLAUDE.md"): ein verschobener Abschnitt bricht diese
// Verweise STUMM, und niemand merkt es, bis jemand die Begründung sucht. Dieser
// Test folgt jedem relativen Markdown-Link in CLAUDE.md, README.md und docs/*.md
// (nicht docs/audits/, das sind Momentaufnahmen) und prüft Datei UND Anker.
//
// Was er nicht sieht: ein Verweis im Fließtext ohne Link ("siehe CLAUDE.md").
// Das fängt die Suche, die beim Verschieben eines Abschnitts dazugehört.

const ROOT = join(__dirname, "..", "..");

function docFiles(): string[] {
  const files = ["CLAUDE.md", "README.md"];
  for (const f of readdirSync(join(ROOT, "docs"))) if (f.endsWith(".md")) files.push(`docs/${f}`);
  return files.filter((f) => existsSync(join(ROOT, f)));
}

const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8").replaceAll("\r\n", "\n");

/**
 * Der Text ohne Codeblöcke und ohne Inline-Code: Beispiele dort sind keine Links.
 * Zäune werden zeilenweise gezählt, nicht per Muster über die ganze Datei: der
 * Changelog trägt Zitate mit eingerückten Zäunen, und ein einzelner ungerader Zaun
 * würde mit einem Muster alles danach verschlucken.
 */
function withoutCode(text: string): string {
  let inFence = false;
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) kept.push(line.replace(/`[^`\n]*`/g, ""));
  }
  return kept.join("\n");
}

/** Die Anker, die GitHub für die Überschriften einer Markdown-Datei erzeugt. */
function anchorsOf(text: string): Set<string> {
  const seen = new Map<string, number>();
  const anchors = new Set<string>();
  for (const line of withoutCode(text).split("\n")) {
    const m = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const base = m[1]
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .replace(/\s/g, "-");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    anchors.add(n === 0 ? base : `${base}-${n}`);
  }
  return anchors;
}

describe("Doku-Links", () => {
  const anchorCache = new Map<string, Set<string>>();
  const anchorsFor = (rel: string) => {
    if (!anchorCache.has(rel)) anchorCache.set(rel, anchorsOf(read(rel)));
    return anchorCache.get(rel)!;
  };

  it.each(docFiles())("%s: jeder relative Link führt zu einer Datei und einem vorhandenen Anker", (file) => {
    const broken: string[] = [];
    for (const m of withoutCode(read(file)).matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|tel:)/.test(target)) continue;

      const [path, anchor] = target.split("#");
      const resolved = path === "" ? file : relative(ROOT, resolve(ROOT, dirname(file), path)).replaceAll("\\", "/");
      if (!existsSync(join(ROOT, resolved))) {
        broken.push(`${target}: Datei ${resolved} fehlt`);
        continue;
      }
      if (anchor && resolved.endsWith(".md") && !anchorsFor(resolved).has(anchor.toLowerCase())) {
        broken.push(`${target}: Anker #${anchor} gibt es in ${resolved} nicht`);
      }
    }
    expect(broken, `${file}:\n  ${broken.join("\n  ")}`).toEqual([]);
  });

  it("der Anhang des Changelogs, auf den CLAUDE.md verweist, existiert", () => {
    // Der Verweis steht in den Arbeitsregeln; hier eigens, weil er die Messungen
    // trägt, die aus CLAUDE.md gekürzt wurden.
    expect(anchorsFor("docs/CHANGELOG-2026.md")).toContain("anhang-aus-claudemd-ausgelagert-am-2026-10-06");
    expect(read("CLAUDE.md")).toContain("docs/CHANGELOG-2026.md#anhang-aus-claudemd-ausgelagert-am-2026-10-06");
  });

  it("die Begründung gegen Embeddings steht in docs/SETUP.md, wie CLAUDE.md es sagt", () => {
    expect(read("CLAUDE.md")).toMatch(/Keine Embeddings, bewusst\.\*\*[\s\S]*docs\/SETUP\.md/);
    expect(read("docs/SETUP.md")).toMatch(/Keine Embeddings, und das ist eine Entscheidung/);
    expect(read("docs/SETUP.md")).toMatch(/Erst dann neu bewerten/);
  });
});
