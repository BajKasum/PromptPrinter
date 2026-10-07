import { afterEach, describe, expect, it, vi } from "vitest";
import { optionalEnv } from "@/server/env-value";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("optionalEnv", () => {
  it("gibt den Wert zurück, wenn einer gesetzt ist", () => {
    vi.stubEnv("PP_TEST_OPTIONAL", "glm-5.2");
    expect(optionalEnv("PP_TEST_OPTIONAL")).toBe("glm-5.2");
  });

  it("schneidet Leerraum an den Rändern ab (ein eingefügter Zeilenumbruch gehört nicht zum Wert)", () => {
    vi.stubEnv("PP_TEST_OPTIONAL", "  ghp_abc123\n");
    expect(optionalEnv("PP_TEST_OPTIONAL")).toBe("ghp_abc123");
  });

  it("behandelt eine leer gesetzte Variable wie eine fehlende (nie der leere Text)", () => {
    vi.stubEnv("PP_TEST_OPTIONAL", "");
    expect(optionalEnv("PP_TEST_OPTIONAL")).toBeUndefined();
  });

  it("behandelt eine Variable aus nur Leerzeichen wie eine fehlende", () => {
    vi.stubEnv("PP_TEST_OPTIONAL", " \t\n ");
    expect(optionalEnv("PP_TEST_OPTIONAL")).toBeUndefined();
  });

  it("gibt für eine nicht gesetzte Variable undefined zurück", () => {
    vi.stubEnv("PP_TEST_OPTIONAL", undefined);
    expect(optionalEnv("PP_TEST_OPTIONAL")).toBeUndefined();
  });
});
