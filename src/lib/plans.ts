export type PlanKey = "free" | "pro" | "team";

// Marketed allowances per plan — the single source of truth for both the usage
// meters (settings, billing) and the server-side enforcement in /api/generate.
// `Infinity` means "no cap" (paid plans have unlimited projects).
export const PLAN_LIMITS: Record<PlanKey, { projects: number; generations: number }> = {
  free: { projects: 3, generations: 20 },
  pro: { projects: Infinity, generations: 500 },
  team: { projects: Infinity, generations: 500 },
};

// Admin is a role (profiles.is_admin), not a plan — it never changes what
// `plan` a profile is on, only whether its limits actually bind. Centralized
// here so every call site (settings, billing, /api/generate) answers "is this
// account exempt" the same one way instead of re-deriving it.
export function effectiveLimits(
  plan: PlanKey,
  isAdmin: boolean
): { projects: number; generations: number } {
  return isAdmin ? { projects: Infinity, generations: Infinity } : PLAN_LIMITS[plan];
}
