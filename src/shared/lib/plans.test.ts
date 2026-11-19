import { describe, expect, it } from "vitest";
import {
  effectiveLimits,
  FREE_TRIAL,
  PLAN_LIMITS,
  requiresOwnKey,
  resolvePlan,
  toPlanKey,
} from "@/shared/lib/plans";

describe("PLAN_LIMITS", () => {
  it("kennt genau einen Plan, Free", () => {
    expect(Object.keys(PLAN_LIMITS)).toEqual(["free"]);
  });

  // Ohne eigenen Key bleibt Free nur der Gratis-Rahmen (server/free-trial.ts), kein Kontingent auf dem Server-Key:
  // eine Zahl über 0 öffnete den Server-Key ohne die Grenzen des Rahmens (je IP, eigenes Tagesbudget).
  it("gibt Free keinen eigenen Zugang zum Server-Key, nur den Gratis-Rahmen", () => {
    expect(PLAN_LIMITS.free.chatMessages).toBe(0);
    expect(FREE_TRIAL.prompts).toBeGreaterThan(0);
  });
});

describe("effectiveLimits", () => {
  it("returns the plan's own limits for a non-admin account", () => {
    expect(effectiveLimits("free", false)).toEqual(PLAN_LIMITS.free);
  });

  it("returns unlimited for an admin account", () => {
    expect(effectiveLimits("free", true)).toEqual({
      projects: Infinity,
      chatMessages: Infinity,
    });
  });

  // Snapshotted rather than compared against literals: this asserts that
  // effectiveLimits doesn't MUTATE the table, which is true whatever the
  // numbers happen to be.
  it("never mutates PLAN_LIMITS itself, admin is a role, not a plan", () => {
    const before = structuredClone(PLAN_LIMITS);
    effectiveLimits("free", true);
    expect(PLAN_LIMITS).toEqual(before);
  });
});

describe("toPlanKey", () => {
  it("macht aus jedem gespeicherten Wert Free, auch aus einem alten pro oder team", () => {
    for (const raw of ["pro", "team", "free", "enterprise", "", null, undefined]) {
      expect(toPlanKey(raw), String(raw)).toBe("free");
    }
  });
});

describe("resolvePlan", () => {
  it("macht aus einer fehlenden Zeile ein Free-Konto ohne Adminrechte", () => {
    for (const missing of [null, undefined, {}]) {
      const resolved = resolvePlan(missing);
      expect(resolved.plan).toBe("free");
      expect(resolved.isAdmin).toBe(false);
      expect(resolved.limits).toEqual(PLAN_LIMITS.free);
    }
  });

  // Eine Zeile mit plan = 'pro' aus der Zeit mit Bezahlung bleibt in der Datenbank stehen. Sie darf weder abstürzen
  // (PLAN_LIMITS.pro gibt es nicht) noch den Server-Key öffnen.
  it("behandelt eine alte Zeile mit plan = 'pro' wie Free", () => {
    expect(resolvePlan({ plan: "pro", is_admin: false })).toEqual({
      plan: "free",
      isAdmin: false,
      limits: PLAN_LIMITS.free,
    });
    expect(resolvePlan({ plan: "pro", is_admin: null }).limits).toEqual(PLAN_LIMITS.free);
  });

  it("behandelt einen unbekannten Planwert wie Free", () => {
    expect(resolvePlan({ plan: "enterprise", is_admin: false }).plan).toBe("free");
    expect(resolvePlan({ plan: "enterprise", is_admin: false }).limits).toEqual(PLAN_LIMITS.free);
  });

  it("hebt für einen Admin beide Grenzen auf, ohne den Plan zu ändern", () => {
    for (const plan of ["free", "pro"]) {
      const admin = resolvePlan({ plan, is_admin: true });
      expect(admin.plan).toBe("free");
      expect(admin.isAdmin).toBe(true);
      expect(admin.limits).toEqual({ projects: Infinity, chatMessages: Infinity });
    }
  });
});

describe("requiresOwnKey", () => {
  it("is true for an account without a key", () => {
    expect(requiresOwnKey("free", false, false)).toBe(true);
  });

  it("is false once the account has its own key", () => {
    expect(requiresOwnKey("free", false, true)).toBe(false);
  });

  it("is true for an old pro row without a key, it is Free now", () => {
    const { plan, isAdmin } = resolvePlan({ plan: "pro", is_admin: false });
    expect(requiresOwnKey(plan, isAdmin, false)).toBe(true);
  });

  it("is false for an admin, admins are never capped", () => {
    expect(requiresOwnKey("free", true, false)).toBe(false);
  });
});
