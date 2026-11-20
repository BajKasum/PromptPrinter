import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_PREFIXES } from "@/shared/lib/app-routes";
import { SKILL_VERSION, SKILL_ZIP_FILENAME, SKILL_ZIP_SHA256, SKILL_ZIP_URL } from "./skill-data";

// Der Download auf /skill führt zu Code, den Besucher auf ihrem Rechner ausführen (#240). Die Prüfsumme neben dem
// Knopf gilt nur für genau diese Datei; Version, Datei und Prüfsumme ändern sich deshalb nur zusammen.

describe("Skill-Download", () => {
  it("liegt auf dieser Seite, mit der Version im Dateinamen", () => {
    expect(SKILL_ZIP_FILENAME).toBe(`promptprinter-pp-${SKILL_VERSION}.zip`);
    expect(SKILL_ZIP_URL).toBe(`/skill/${SKILL_ZIP_FILENAME}`);
  });

  // Die Middleware läuft auch für .zip (ihr matcher nimmt nur Bilder aus): ein Pfad ausserhalb der öffentlichen
  // Präfixe leitete Besucher ohne Konto auf /login statt zur Datei.
  it("liegt unter einem öffentlichen Pfad, braucht also keine Anmeldung", () => {
    expect(PUBLIC_PREFIXES.some((prefix) => SKILL_ZIP_URL.startsWith(`${prefix}/`))).toBe(true);
  });

  it("die Datei in public/ hat genau die Prüfsumme, die auf der Seite steht", () => {
    const bytes = readFileSync(join(process.cwd(), "public", SKILL_ZIP_URL));
    expect(SKILL_ZIP_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(SKILL_ZIP_SHA256);
  });

  // Hält das Paar fest, damit nicht ein Wert allein wandert. Wer die Version anhebt, legt die neue Datei nach
  // public/skill/, ändert Version und Prüfsumme in skill-data.ts UND hier.
  it("ändert Version und Prüfsumme nur zusammen", () => {
    expect({ version: SKILL_VERSION, sha256: SKILL_ZIP_SHA256 }).toEqual({
      version: "0.3.0",
      sha256: "88bceb21837d06ac04eb3902ff83a38dd4015d188e041f78e4bb74e88ce75e37",
    });
  });
});
