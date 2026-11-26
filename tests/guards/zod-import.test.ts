import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { moduleReferences, parse, resolveModule } from "./parse-source";

// `z` kommt immer aus "@/shared/lib/zod", nie aus "zod" (Betriebs-Audit, Folgesitzung 2026-10-07, Teil F).
//
// Dieses Modul setzt beim Laden die Meldungsfunktion, die die Texte von zod 3 beibehält (siehe den Kopfkommentar
// dort): die Routen geben sie in der 400-Antwort weiter, und tests/…/*.validation.test.ts halten sie fest. Eine
// Datei, die `z` direkt aus "zod" holt, baut ihr Schema vielleicht vor dem Aufruf von `z.config()`, oder in einem
// Bündel, das das Modul nie lädt, und bekäme dann den neuen Wortlaut: ohne Fehler, ohne Warnung, nur mit anderem Text.
//
// Die Importe liest der Parser (parse-source.ts): jede Schreibweise zählt, auch `import()`, `require` und ein
// relativer Pfad zum Wrapper, ein Kommentar nicht.
const ROOT = process.cwd();
const WRAPPER = "src/shared/lib/zod.ts";
const WRAPPER_MODULE = "src/shared/lib/zod";

/** Die Zeilen einer Datei, die das Paket "zod" selbst nennen, auch `zod/v4`. */
function directZodImports(file: string, text?: string): number[] {
  return moduleReferences(parse(file, text))
    .filter((ref) => ref.kind !== "vi" && ref.specifier !== null && /^zod(?:\/|$)/.test(ref.specifier))
    .map((ref) => ref.line);
}

/** Holt die Datei `z` als Wert aus dem Wrapper (`import { z }`, auch umbenannt oder neben anderen, `export { z } from`)? */
function importsNamedZ(file: string, text?: string): boolean {
  return moduleReferences(parse(file, text)).some(
    (ref) =>
      (ref.kind === "import" || ref.kind === "export") &&
      ref.specifier !== null &&
      resolveModule(file, ref.specifier) === WRAPPER_MODULE &&
      ref.values.includes("z")
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(?:ts|tsx|mts|js|jsx|mjs)$/.test(entry.name) ? [full] : [];
  });
}

const files = sourceFiles(join(ROOT, "src")).map((file) => relative(ROOT, file).replace(/\\/g, "/"));

describe("zod nur über den Wrapper", () => {
  it("keine Datei in src/ importiert 'zod' direkt, außer dem Wrapper selbst", () => {
    expect(files.length).toBeGreaterThan(100);

    const offenders = files.filter((file) => file !== WRAPPER && directZodImports(file).length > 0);

    expect(
      offenders,
      `Diese Dateien importieren "zod" direkt. Importiere stattdessen { z } aus "@/shared/lib/zod" ` +
        `(sonst fehlen die Meldungen von zod 3, siehe den Kopf von ${WRAPPER}):\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  it("der Wrapper selbst importiert zod und setzt die Meldungsfunktion, bevor er z ausgibt", () => {
    const wrapper = readFileSync(join(ROOT, WRAPPER), "utf8");
    expect(wrapper).toMatch(/import \{ config, type z \} from "zod";/);
    const configAt = wrapper.indexOf("config({ customError:");
    const exportAt = wrapper.indexOf('export * from "zod";');
    expect(configAt).toBeGreaterThan(-1);
    expect(exportAt).toBeGreaterThan(configAt);
  });

  // #134: `import { z }` aus dem Wrapper macht z zu einem Wert, und Webpack nimmt dann jeden Export von zod ins
  // Bündel (393 KB roh, 89 KB gzip auf /login, samt aller Sprachpakete). `import * as z` ist derselbe Quelltext
  // (`z.object(...)`), aber ein Namensraum des Wrappers: nur was benutzt wird, kommt mit (24 KB gzip). Auf dem
  // Server ist die Grösse egal. Der Guard erlaubt `import { z }` nur dort und nennt sonst die Datei.
  it("im Browser-Code ist es `import * as z`, `import { z }` nur auf dem Server", () => {
    const serverOnly = (file: string) =>
      file.startsWith("src/server/") ||
      file.startsWith("src/app/api/") ||
      // Nur von den API-Routen geladen (Chat-Anfrage), nie von einer Komponente.
      file === "src/shared/lib/schemas.ts" ||
      /\.test\.tsx?$/.test(file);

    const offenders = files.filter((file) => file !== WRAPPER && !serverOnly(file) && importsNamedZ(file));

    expect(
      offenders,
      `Diese Dateien können im Browser landen und importieren { z } aus dem Wrapper. Schreib stattdessen ` +
        `import * as z from "@/shared/lib/zod" (sonst wächst das Bündel von /login um rund 65 KB, siehe den ` +
        `Kopf von ${WRAPPER}):\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  it("erkennt `import { z }` auch neben anderen Namen, umbenannt, relativ und als Re-Export", () => {
    const ui = "src/shared/ui/form.tsx";
    expect(importsNamedZ(ui, `import { z } from "@/shared/lib/zod";`)).toBe(true);
    expect(importsNamedZ(ui, `import { z, responseIssues } from "@/shared/lib/zod";`)).toBe(true);
    expect(importsNamedZ(ui, `import { responseIssues, z } from '@/shared/lib/zod'`)).toBe(true);
    expect(importsNamedZ(ui, `import { z as zod } from "@/shared/lib/zod";`)).toBe(true);
    expect(importsNamedZ(ui, `import { z } from "../lib/zod";`)).toBe(true);
    expect(importsNamedZ("src/shared/lib/form.ts", `import { z } from "./zod";`)).toBe(true);
    expect(importsNamedZ(ui, `export { z } from "@/shared/lib/zod";`)).toBe(true);

    expect(importsNamedZ(ui, `import { responseIssues } from "@/shared/lib/zod";`)).toBe(false);
    expect(importsNamedZ(ui, `import * as z from "@/shared/lib/zod";`)).toBe(false);
    expect(importsNamedZ(ui, `import type { z } from "@/shared/lib/zod";`)).toBe(false);
    expect(importsNamedZ(ui, `import { type z } from "@/shared/lib/zod";`)).toBe(false);
    expect(importsNamedZ(ui, `// import { z } from "@/shared/lib/zod";`)).toBe(false);
    expect(importsNamedZ("src/features/chat/lib/form.ts", `import { z } from "./zod";`)).toBe(false);
  });

  it("erkennt die Schreibweisen, die den Wrapper umgehen würden", () => {
    const file = "src/features/chat/lib/form.ts";
    for (const bad of [
      `import { z } from "zod";`,
      `import { z } from 'zod'`,
      `import { z } from "zod/v4";`,
      `import * as z from "zod"`,
      `export { z } from "zod";`,
      `const { z } = require("zod");`,
      `const zod = await import("zod");`,
      "const zod = await import(`zod`);",
      `type Z = typeof import("zod");`,
    ]) {
      expect(directZodImports(file, bad), bad).toHaveLength(1);
    }
    for (const fine of [
      `import { z } from "@/shared/lib/zod";`,
      `import { z } from "./zod";`,
      `import { zodResolver } from "some-zod-thing";`,
      `// kommt aus "zod" nicht direkt`,
      `// import { z } from "zod";`,
      `const name = "zod";`,
    ]) {
      expect(directZodImports(file, fine), fine).toEqual([]);
    }
  });
});
