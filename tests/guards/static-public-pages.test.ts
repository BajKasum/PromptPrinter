import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Haelt fest, was die oeffentlichen Seiten statisch ausliefer­bar macht
// (Planpunkt B-2).
//
// ─── Warum ein Guard und nicht bloss ein Kommentar ────────────────────────
// Der teure Zustand war: `src/app/layout.tsx` las EINE Zeile `headers()`, um
// next-themes' Anti-Flash-Nonce zu holen — und ein `headers()`-Aufruf im
// Root-Layout macht den GESAMTEN Routenbaum dynamisch. Ergebnis: alle 38
// Routen wurden pro Aufruf gerendert und mit `Cache-Control: no-store`
// ausgeliefert, auch `/agb`, `/impressum` und die zehn `/docs`-Seiten. Live
// gemessen 360–510 ms TTFB bei durchgehend `X-Vercel-Cache: MISS`.
//
// Genau diese Zeile kommt zurueck, sobald jemand im Root-Layout etwas
// braucht, das nach Request aussieht — und der Rueckfall ist voellig
// unsichtbar: nichts wird kaputt, die Seiten sind nur wieder langsam. Kein
// Test schlaegt an, kein Nutzer beschwert sich, die Rechnung steigt leise.
// Deshalb steht die Eigenschaft hier als Zusicherung.
//
// `cookies()` und `draftMode()` haetten dieselbe Wirkung und stehen deshalb
// mit in der Liste.

const ROOT = process.cwd();

function source(...segments: string[]): string {
  return readFileSync(join(ROOT, ...segments), "utf8");
}

/** Kommentare raus: dieselbe Erklaerung, die hier steht, darf nicht ausloesen. */
function withoutComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

describe("Statische oeffentliche Seiten", () => {
  const rootLayout = withoutComments(source("src", "app", "layout.tsx"));

  it.each(["headers", "cookies", "draftMode"])(
    "ruft %s() nicht im Root-Layout auf",
    (api) => {
      expect(
        new RegExp(`\\b${api}\\s*\\(`).test(rootLayout),
        `src/app/layout.tsx ruft ${api}() auf. Das macht JEDE Route dynamisch — ` +
          `auch die Rechtstexte und /docs. Was den Request braucht, gehoert in ` +
          `(app)/layout.tsx, das ohnehin dynamisch ist.`
      ).toBe(false);
    }
  );

  // Der Nonce muss dort ankommen, wo next-themes ihn braucht. Faellt das weg,
  // blockiert die CSP das Anti-Flash-Script und die App flackert beim Laden.
  it("liest den Nonce im eingeloggten Layout und reicht ihn an den ThemeProvider", () => {
    const appLayout = source("src", "app", "(app)", "layout.tsx");
    expect(appLayout).toContain('headers()).get("x-nonce")');
    expect(appLayout).toContain("<ThemeProvider");
    expect(appLayout).toContain("nonce={nonce}");
  });

  // reduced-motion ist Barrierefreiheit, keine Vorliebe: es muss auch auf der
  // Landing Page gelten, der bewegtesten Flaeche des Produkts.
  it("haelt MotionShell im Root-Layout, damit reduced-motion oeffentlich gilt", () => {
    expect(rootLayout).toContain("<MotionShell>");
  });
});
