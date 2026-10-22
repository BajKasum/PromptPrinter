import { describe, expect, it } from "vitest";
import { projectKind, structureFields } from "./project-kind";

describe("projectKind", () => {
  it("erkennt ein Softwareprojekt am Typ", () => {
    expect(projectKind("software")).toBe("software");
  });

  it("nimmt alles andere als allgemeines Projekt", () => {
    expect(projectKind("general")).toBe("general");
    expect(projectKind(undefined)).toBe("general");
    expect(projectKind(null)).toBe("general");
    expect(projectKind("Software")).toBe("general");
  });
});

describe("structureFields", () => {
  it("zeigt einem allgemeinen Projekt Zielgruppe, Ton und Hintergrund", () => {
    expect(structureFields("general", {})).toEqual(["audience", "tone", "background", "notes"]);
  });

  it("zeigt einem Softwareprojekt die technischen Felder", () => {
    expect(structureFields("software", {})).toEqual([
      "frontend",
      "backend",
      "language",
      "database",
      "notes",
    ]);
  });

  it("behält ein Feld der anderen Art, sobald es Inhalt trägt", () => {
    expect(structureFields("general", { frontend: "Vue", database: "  " })).toEqual([
      "audience",
      "tone",
      "background",
      "frontend",
      "notes",
    ]);
    expect(structureFields("software", { tone: "sachlich" })).toEqual([
      "frontend",
      "backend",
      "language",
      "database",
      "tone",
      "notes",
    ]);
  });
});
