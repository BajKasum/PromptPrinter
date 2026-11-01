import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL } from "@/shared/lib/legal";
import { buildSecurityTxt } from "./build-security-txt";

describe("security.txt", () => {
  const text = buildSecurityTxt(new Date("2026-11-01T00:00:00Z"));

  it("nennt die Pflichtfelder nach RFC 9116", () => {
    expect(text).toContain(`Contact: mailto:${LEGAL.email}`);
    expect(text).toContain("Expires: 2027-11-01T00:00:00.000Z");
  });

  it("zeigt auf die Richtlinie im Repository, und SECURITY.md nennt dieselbe Adresse", () => {
    expect(text).toContain("Policy: https://github.com/BajKasum/PromptPrinter/blob/main/SECURITY.md");
    expect(readFileSync(join(process.cwd(), "SECURITY.md"), "utf8")).toContain(LEGAL.email);
  });

  it("bleibt unter einem Jahr gültig, wie der RFC empfiehlt", () => {
    const expires = /Expires: (.+)/.exec(text)?.[1] ?? "";
    expect(new Date(expires).getTime() - Date.parse("2026-11-01T00:00:00Z")).toBeLessThanOrEqual(366 * 86_400_000);
  });
});
