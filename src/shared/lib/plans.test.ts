import { describe, expect, it } from "vitest";
import { effectiveLimits, PLAN_LIMITS } from "@/shared/lib/plans";

describe("effectiveLimits", () => {
  it("returns the plan's own limits for a non-admin account", () => {
    expect(effectiveLimits("free", false)).toEqual(PLAN_LIMITS.free);
    expect(effectiveLimits("pro", false)).toEqual(PLAN_LIMITS.pro);
  });

  it("returns unlimited for an admin account regardless of plan", () => {
    expect(effectiveLimits("free", true)).toEqual({
      projects: Infinity,
      chatMessages: Infinity,
    });
  });

  // Snapshotted rather than compared against literals: this asserts that
  // effectiveLimits doesn't MUTATE the table, which is true whatever the
  // numbers happen to be. Hardcoding them made a deliberate re-pricing
  // (2026-07-29: free 200→50, pro 2000→400; 2026-07-30: free 50→25→0,
  // pro 400→350→400) look like a regression in a test that was never about
  // the values.
  it("never mutates PLAN_LIMITS itself, admin is a role, not a plan", () => {
    const before = structuredClone(PLAN_LIMITS);
    effectiveLimits("free", true);
    effectiveLimits("pro", true);
    expect(PLAN_LIMITS).toEqual(before);
  });
});

// The marketed copy has to state the same numbers the server actually
// enforces — they lived in two unconnected places until lib/pricing.ts derived
// one from the other.
describe("marketed plans match enforced limits", () => {
  // Re-modelled 2026-07-30: Free's allowance is 0 by design (BYOK-only, see
  // plans.ts and pricing.ts's own top comments), so advertising "0 prompts"
  // would read as a broken free tier rather than the intended gate. The copy
  // has to say "bring your own key" instead of quoting the number.
  it("free's copy states the BYOK requirement instead of quoting its zero allowance", async () => {
    const { PLANS } = await import("@/shared/lib/pricing");
    const free = PLANS.find((p) => p.name === "Free");

    expect(PLAN_LIMITS.free.chatMessages).toBe(0);
    expect(free?.features.some((f) => f.includes(String(PLAN_LIMITS.free.chatMessages)))).toBe(
      false
    );
    expect(free?.features.some((f) => /eigene\w*\s*KI-Key/i.test(f))).toBe(true);
  });

  it("pro's copy quotes the enforced monthly prompt allowance", async () => {
    const { PLANS } = await import("@/shared/lib/pricing");
    const pro = PLANS.find((p) => p.name === "Pro");

    expect(pro?.features.some((f) => f.includes(String(PLAN_LIMITS.pro.chatMessages)))).toBe(true);
  });

  it("keeps Pro's price and the free tier's zero price in sync with the config", async () => {
    const { PLANS, PRO_PRICE_LABEL } = await import("@/shared/lib/pricing");
    expect(PLANS.find((p) => p.name === "Free")?.price).toBe("0 €");
    expect(PLANS.find((p) => p.name === "Pro")?.price).toBe(PRO_PRICE_LABEL);
  });

  // The old badge claimed a Pro/Free usage multiplier ("10× mehr Nutzung").
  // That comparison no longer has a basis: Free has zero server-key usage to
  // multiply from. Pro's badge now states the actual differentiator instead
  // — asserted literally, so a future edit can't quietly reintroduce a
  // numeric claim with nothing to back it.
  it("pro's badge states the real differentiator, not a stale usage multiplier", async () => {
    const { PLANS } = await import("@/shared/lib/pricing");
    const pro = PLANS.find((p) => p.name === "Pro");

    expect(pro?.badge).toBe("Kein eigener Key nötig");
    expect(pro?.badge).not.toMatch(/\d+\s*×/);
  });
});
