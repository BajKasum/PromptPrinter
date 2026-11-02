import { describe, expect, it, vi } from "vitest";
import { hasVerifiedFactor, lacksSecondFactor } from "@/server/supabase/assurance";

const client = (claims: { aal?: unknown } | null) => {
  const getClaims = vi.fn(async () => ({ data: claims ? { claims } : null }));
  return { auth: { getClaims } };
};

const VERIFIED = { factors: [{ status: "verified" }] };

describe("hasVerifiedFactor", () => {
  it("zählt nur bestätigte Faktoren", () => {
    expect(hasVerifiedFactor(VERIFIED)).toBe(true);
    expect(hasVerifiedFactor({ factors: [{ status: "unverified" }] })).toBe(false);
    expect(hasVerifiedFactor({ factors: [] })).toBe(false);
    expect(hasVerifiedFactor({ factors: null })).toBe(false);
    expect(hasVerifiedFactor({})).toBe(false);
  });
});

describe("lacksSecondFactor", () => {
  it("ein Konto ohne Faktor braucht keinen Nachweis, und es wird nichts gefragt", async () => {
    const supabase = client({ aal: "aal1" });
    expect(await lacksSecondFactor(supabase, {})).toBe(false);
    expect(await lacksSecondFactor(supabase, { factors: [{ status: "unverified" }] })).toBe(false);
    expect(supabase.auth.getClaims).not.toHaveBeenCalled();
  });

  it("mit Faktor und AAL2 ist alles gut", async () => {
    expect(await lacksSecondFactor(client({ aal: "aal2" }), VERIFIED)).toBe(false);
  });

  it.each([
    ["AAL1", { aal: "aal1" }],
    ["kein aal im JWT", {}],
    ["kein lesbares JWT", null],
  ])("mit Faktor fehlt der Nachweis bei: %s", async (_label, claims) => {
    expect(await lacksSecondFactor(client(claims), VERIFIED)).toBe(true);
  });
});
