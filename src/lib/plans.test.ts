import { describe, expect, it } from "vitest";
import { effectiveLimits, PLAN_LIMITS } from "@/lib/plans";

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
  // (2026-07-29: free 200→50, pro 2000→400; 2026-07-30: free 50→25,
  // pro 400→350) look like a regression in a test that was never about the
  // values.
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
  it("quotes the enforced monthly prompt allowance on both plan cards", async () => {
    const { PLANS } = await import("@/lib/pricing");
    const free = PLANS.find((p) => p.name === "Free");
    const pro = PLANS.find((p) => p.name === "Pro");

    expect(free?.features.some((f) => f.includes(String(PLAN_LIMITS.free.chatMessages)))).toBe(
      true
    );
    expect(pro?.features.some((f) => f.includes(String(PLAN_LIMITS.pro.chatMessages)))).toBe(true);
  });

  it("keeps Pro's price and the free tier's zero price in sync with the config", async () => {
    const { PLANS, PRO_PRICE_LABEL } = await import("@/lib/pricing");
    expect(PLANS.find((p) => p.name === "Free")?.price).toBe("0 €");
    expect(PLANS.find((p) => p.name === "Pro")?.price).toBe(PRO_PRICE_LABEL);
  });

  // 350 / 25 = 14×. The Pro card's badge deliberately says "10× mehr Nutzung"
  // — a round number that must stay an UNDERSTATEMENT of the real ratio, never
  // an overstatement, however either limit moves later.
  it("never overstates the Pro/Free usage multiplier in the marketing badge", async () => {
    const { PLANS } = await import("@/lib/pricing");
    const pro = PLANS.find((p) => p.name === "Pro");
    const claimed = Number(pro?.badge?.match(/(\d+)×/)?.[1]);

    expect(Number.isFinite(claimed)).toBe(true);
    expect(PLAN_LIMITS.pro.chatMessages / PLAN_LIMITS.free.chatMessages).toBeGreaterThanOrEqual(
      claimed
    );
  });
});
