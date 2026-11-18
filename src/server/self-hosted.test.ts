import { describe, expect, it } from "vitest";
import { hasSelfHostedOnVercel, isSelfHosted } from "./self-hosted";

describe("isSelfHosted", () => {
  it("gilt nur bei SELF_HOSTED=1 ausserhalb von Vercel", () => {
    expect(isSelfHosted({ SELF_HOSTED: "1" })).toBe(true);
    expect(isSelfHosted({ SELF_HOSTED: " 1 " })).toBe(true);
  });

  it.each([
    ["nicht gesetzt (promptprinter.app)", {}],
    ["leer", { SELF_HOSTED: "" }],
    ["0", { SELF_HOSTED: "0" }],
    ["true statt 1", { SELF_HOSTED: "true" }],
    ["yes", { SELF_HOSTED: "yes" }],
    ["auf Vercel", { SELF_HOSTED: "1", VERCEL: "1" }],
  ])("gilt nicht: %s", (_label, env) => {
    expect(isSelfHosted(env)).toBe(false);
  });

  it("meldet den Widerspruch SELF_HOSTED=1 auf Vercel, sonst nicht", () => {
    expect(hasSelfHostedOnVercel({ SELF_HOSTED: "1", VERCEL: "1" })).toBe(true);
    expect(hasSelfHostedOnVercel({ VERCEL: "1" })).toBe(false);
    expect(hasSelfHostedOnVercel({ SELF_HOSTED: "1" })).toBe(false);
  });
});
