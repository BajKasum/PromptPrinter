import { describe, expect, it } from "vitest";
import { isUuid } from "./uuid";

describe("isUuid", () => {
  it("nimmt eine UUID in jeder Schreibweise, sonst nichts", () => {
    expect(isUuid("0b6f1c2e-6a1d-4c8e-9f0a-1b2c3d4e5f60")).toBe(true);
    expect(isUuid("0B6F1C2E-6A1D-4C8E-9F0A-1B2C3D4E5F60")).toBe(true);
    expect(isUuid("nicht-uuid")).toBe(false);
    expect(isUuid("0b6f1c2e-6a1d-4c8e-9f0a-1b2c3d4e5f60x")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});
