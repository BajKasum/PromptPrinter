import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { isUuid } from "./uuid";

/** Ein eigenes Muster für eine ganze UUID: verankert am Anfang, acht Hexzeichen, Strich. */
const ANCHORED_COPY = /\^\[0-9a-f(?:A-F)?\]\{8\}-/i;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("isUuid", () => {
  it("nimmt eine UUID in jeder Schreibweise, sonst nichts", () => {
    expect(isUuid("0b6f1c2e-6a1d-4c8e-9f0a-1b2c3d4e5f60")).toBe(true);
    expect(isUuid("0B6F1C2E-6A1D-4C8E-9F0A-1B2C3D4E5F60")).toBe(true);
    expect(isUuid("nicht-uuid")).toBe(false);
    expect(isUuid("0b6f1c2e-6a1d-4c8e-9f0a-1b2c3d4e5f60x")).toBe(false);
    expect(isUuid("")).toBe(false);
  });

  // Eine abweichende Kopie (Anker, Gross- und Kleinschreibung) liesse zwei Stellen dieselbe Kennung verschieden
  // beurteilen.
  it("ist im ganzen src/ die einzige Prüfung einer ganzen UUID", () => {
    const root = join(process.cwd(), "src");
    const withPattern = sources(root)
      .filter((file) => ANCHORED_COPY.test(readFileSync(file, "utf8")))
      .map((file) => relative(root, file).replace(/\\/g, "/"));

    expect(withPattern).toEqual(["shared/lib/uuid.ts"]);
  });
});
