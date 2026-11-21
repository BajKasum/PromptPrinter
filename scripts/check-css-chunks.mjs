// Prüft nach `next build`, dass das CSS der Seiten in genau einer Datei liegt.
//
// Turbopack legt src/app/globals.css, die Tailwind-Utilities und das CSS der Schriften (next/font) nur bis rund
// 100 KB unkomprimiert in eine Datei. Darüber kommt das Schrift-CSS als zweites Stylesheet, und jedes Stylesheet
// im <head> blockiert das erste Bild: Lighthouse mobil zeigte auf der Startseite rund 250 ms spätere FCP und LCP.
// Schlägt die Prüfung an: ungenutzte Regeln aus globals.css löschen, oder, wenn die zweite Datei gewollt ist,
// diese Prüfung bewusst anpassen.
//
// Aufruf: node scripts/check-css-chunks.mjs [verzeichnis], Standard .next/static/chunks.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Bewertet die CSS-Dateien eines Builds.
 * @param {{ name: string, bytes: number }[]} files
 * @returns {{ ok: boolean, message: string }}
 */
export function evaluateCssChunks(files) {
  const list = files.map((f) => `  ${f.name}  ${f.bytes} Bytes`).join("\n");
  if (files.length === 0) {
    return { ok: false, message: "Keine .css-Datei im Build gefunden. Lief `next build` vorher?" };
  }
  if (files.length > 1) {
    return {
      ok: false,
      message:
        `${files.length} Stylesheets statt einem, jedes blockiert das erste Bild:\n${list}\n` +
        "Vermutlich liegt das CSS über der Grenze, bis zu der Turbopack zusammenlegt (rund 100 KB). " +
        "Ungenutzte Regeln aus src/app/globals.css entfernen.",
    };
  }
  return { ok: true, message: `Ein Stylesheet:\n${list}` };
}

function main() {
  const dir = process.argv[2] ?? join(".next", "static", "chunks");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".css"))
    .map((name) => ({ name, bytes: statSync(join(dir, name)).size }));
  const { ok, message } = evaluateCssChunks(files);
  console.log(message);
  if (!ok) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
