export type PlanKey = "free" | "pro" | "team";

export type PlanLimits = { projects: number; generations: number; chatMessages: number };

// Marketed allowances per plan — the single source of truth for both the usage
// meters (settings, billing) and the server-side enforcement in /api/generate
// and /api/chat. `Infinity` means "no cap" (paid plans have unlimited projects).
//
// chatMessages counts assistant replies (one per turn) in the current
// calendar month — chat had no monthly cap at all until now, only an hourly
// rate limit (120/hr authed), so a free user with no BYOK key could chat all
// month on the server's own Z.ai key with no real ceiling. 200/month is
// generous for genuinely evaluating the product (~6-7 turns/day) while
// cutting the previous worst case (~86k/month via the rate limit alone) by
// roughly two orders of magnitude. Pro/team scale 10x, same proportion as
// the existing free→pro jump on generations (20→500, 25x) applied more
// conservatively since chat turns are individually cheaper but far more
// frequent. A user's own BYOK key (settings) bypasses this entirely, same as
// it already does for generations — see /api/chat's override check.
export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: { projects: 3, generations: 20, chatMessages: 200 },
  pro: { projects: Infinity, generations: 500, chatMessages: 2000 },
  team: { projects: Infinity, generations: 500, chatMessages: 2000 },
};

// Admin is a role (profiles.is_admin), not a plan — it never changes what
// `plan` a profile is on, only whether its limits actually bind. Centralized
// here so every call site (settings, billing, /api/generate, /api/chat)
// answers "is this account exempt" the same one way instead of re-deriving it.
export function effectiveLimits(plan: PlanKey, isAdmin: boolean): PlanLimits {
  return isAdmin
    ? { projects: Infinity, generations: Infinity, chatMessages: Infinity }
    : PLAN_LIMITS[plan];
}
