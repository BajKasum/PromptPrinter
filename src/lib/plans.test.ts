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
      generations: Infinity,
      chatMessages: Infinity,
    });
  });

  it("never mutates PLAN_LIMITS itself, admin is a role, not a plan", () => {
    effectiveLimits("free", true);
    expect(PLAN_LIMITS.free).toEqual({ projects: 3, generations: 20, chatMessages: 200 });
  });
});
