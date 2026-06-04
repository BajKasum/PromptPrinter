export type PlanKey = "free" | "pro" | "team";

// Marketed allowances per plan — the single source of truth for both the usage
// meters (settings, billing) and the server-side enforcement in /api/generate.
// `Infinity` means "no cap" (paid plans have unlimited projects).
export const PLAN_LIMITS: Record<PlanKey, { projects: number; generations: number }> = {
  free: { projects: 3, generations: 20 },
  pro: { projects: Infinity, generations: 500 },
  team: { projects: Infinity, generations: 500 },
};
