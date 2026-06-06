import { describe, expect, it } from "vitest";
import { countArtifacts, ARTIFACT_KEYS } from "@/lib/artifacts";

describe("countArtifacts", () => {
  it("returns 0 for null, undefined or an empty bundle", () => {
    expect(countArtifacts(null)).toBe(0);
    expect(countArtifacts(undefined)).toBe(0);
    expect(countArtifacts({})).toBe(0);
  });

  it("counts only non-empty string artifacts", () => {
    expect(countArtifacts({ brief: "x", prd: "y", master: "z" })).toBe(3);
  });

  it("ignores whitespace-only values", () => {
    expect(countArtifacts({ brief: "x", prd: "   " })).toBe(1);
  });

  it("ignores keys that are not artifacts (e.g. the synthesized overview)", () => {
    expect(countArtifacts({ overview: "x", foo: "bar" })).toBe(0);
  });

  it("ignores non-string values", () => {
    expect(countArtifacts({ brief: 123, prd: true })).toBe(0);
  });

  it("counts the full artifact set", () => {
    const full = Object.fromEntries(ARTIFACT_KEYS.map((k) => [k, "content"]));
    expect(countArtifacts(full)).toBe(ARTIFACT_KEYS.length);
  });
});
