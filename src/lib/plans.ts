export type PlanKey = "free" | "pro" | "team";

export type PlanLimits = { projects: number; chatMessages: number };

// Marketed allowances per plan, the single source of truth for both the usage
// meters (settings, billing) and the server-side enforcement in /api/chat.
// `Infinity` means "no cap" (paid plans have unlimited projects).
//
// chatMessages counts assistant replies (one per turn) in the current calendar
// month; chat had no monthly cap at all until it was added, only an hourly rate
// limit (120/hr authed), so a free user with no BYOK key could chat all month
// on the server's own Z.ai key with no real ceiling. A user's own BYOK key
// (settings) bypasses this entirely, see /api/chat's override check.
//
// ─── Re-costed 2026-07-29, re-priced 2026-07-30 ──────────────────────────
// 2026-07-29: the original numbers (Free 200, Pro/Team 2000 at 7 €) were
// picked as "generous, and far below the previous worst case" without ever
// being checked against what a turn actually costs. They didn't survive that
// check — see git history for the full math. First correction landed on
// Free 50 / Pro 400 at 5 €, the smallest price that still broke even on a
// worst-case month.
//
// 2026-07-30: moved to Free 25 / Pro 350 at 5,90 € — a product decision on
// top of the cost floor, not a further cost correction. Every Free signup is
// a cost with no revenue behind it (most never convert), so it's kept as
// small as the free tier can be while still being worth trying; Pro is priced
// to be a clearly worthwhile step up rather than a marginal one. This
// combination is the first to stay profitable even in the code's own
// worst-case scenario, not just on average — see lib/pricing.ts for the full
// per-plan math (Pro: ~80% margin typical, still +$1.51 at the ceiling).
//
// Saving prompts to a project's Ergebnisse ("Prompt speichern") is deliberately
// unmetered: it makes no model call, it just keeps text the user already has,
// so there's no cost to ration. Only the project cap and the chat-message cap
// bind. (The old per-month "Generierungen" allowance died with the automatic
// generation pipeline, 2026-07.)
export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: { projects: 3, chatMessages: 25 },
  pro: { projects: Infinity, chatMessages: 350 },
  team: { projects: Infinity, chatMessages: 350 },
};

// Admin is a role (profiles.is_admin), not a plan, it never changes what
// `plan` a profile is on, only whether its limits actually bind. Centralized
// here so every call site (settings, billing, /api/chat, /api/projects)
// answers "is this account exempt" the same one way instead of re-deriving it.
export function effectiveLimits(plan: PlanKey, isAdmin: boolean): PlanLimits {
  return isAdmin
    ? { projects: Infinity, chatMessages: Infinity }
    : PLAN_LIMITS[plan];
}
