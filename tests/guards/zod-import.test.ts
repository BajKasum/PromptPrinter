import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// `z` kommt immer aus "@/shared/lib/zod", nie aus "zod" (Betriebs-Audit, Folgesitzung 2026-10-07, Teil F).
//
// Dieses Modul setzt beim Laden die Meldungsfunktion, die die Texte von zod 3 beibehält (siehe den Kopfkommentar
// dort): die Routen geben sie in der 400-Antwort weiter, und tests/…/*.validation.test.ts halten sie fest. Eine
// Datei, die `z` direkt aus "zod" holt, baut ihr Schema vielleicht vor dem Aufruf von `z.config()`, oder in einem
// Bündel, das das Modul nie lädt, und bekäme dann den neuen Wortlaut: ohne Fehler, ohne Warnung, nur mit anderem Text.
const ROOT = process.cwd();
const WRAPPER = "src/shared/lib/zod.ts";
// Auch der Aufruf als Funktion zählt: `import("zod")` und `require("zod")` umgehen den Wrapper genauso.
const DIRECT_ZOD_IMPORT = /\b(?:from|import|require)\s*\(?\s*["']zod(?:\/[^"']*)?["']/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(?:ts|tsx|mts|js|jsx|mjs)$/.test(entry.name) ? [full] : [];
  });
}

describe("zod nur über den Wrapper", () => {
  it("keine Datei in src/ importiert 'zod' direkt, außer dem Wrapper selbst", () => {
    const files = sourceFiles(join(ROOT, "src"));
    expect(files.length).toBeGreaterThan(100);

    const offenders = files
      .map((file) => relative(ROOT, file).replace(/\\/g, "/"))
      .filter((file) => file !== WRAPPER)
      .filter((file) => DIRECT_ZOD_IMPORT.test(readFileSync(join(ROOT, file), "latin1")));

    expect(
      offenders,
      `Diese Dateien importieren "zod" direkt. Importiere stattdessen { z } aus "@/shared/lib/zod" ` +
        `(sonst fehlen die Meldungen von zod 3, siehe den Kopf von ${WRAPPER}):\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  it("der Wrapper selbst importiert zod und setzt die Meldungsfunktion, bevor er z ausgibt", () => {
    const wrapper = readFileSync(join(ROOT, WRAPPER), "utf8");
    expect(wrapper).toMatch(/import \{ z \} from "zod";/);
    const configAt = wrapper.indexOf("z.config({ customError:");
    const exportAt = wrapper.indexOf("export { z };");
    expect(configAt).toBeGreaterThan(-1);
    expect(exportAt).toBeGreaterThan(configAt);
  });

  it("erkennt die Schreibweisen, die den Wrapper umgehen würden", () => {
    for (const bad of [
      `import { z } from "zod";`,
      `import { z } from 'zod'`,
      `import { z } from "zod/v4";`,
      `import * as z from "zod"`,
      `const { z } = require("zod");`,
      `const zod = await import("zod");`,
    ]) {
      expect(DIRECT_ZOD_IMPORT.test(bad), bad).toBe(true);
    }
    for (const fine of [
      `import { z } from "@/shared/lib/zod";`,
      `import { z } from "./zod";`,
      `import { zodResolver } from "some-zod-thing";`,
      `// kommt aus "zod" nicht direkt`,
    ]) {
      expect(DIRECT_ZOD_IMPORT.test(fine), fine).toBe(false);
    }
  });
});
