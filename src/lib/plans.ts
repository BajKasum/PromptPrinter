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
// ─── Re-costed 2026-07-29 (Free 200→50, Pro/Team 2000→400) ───────────────
// The old numbers were picked as "generous, and far below the previous worst
// case" without ever being checked against what a turn actually costs. They
// don't survive that check: on glm-4.5-air (llm.ts's server default,
// $0.20/$1.10 per 1M in/out) a typical turn is ~$0.0032 and the worst case the
// code itself budgets for is ~$0.0116. So the old Pro plan promised 2000
// prompts — $6.40 of model spend at typical usage, $23 at the ceiling — for
// 7 €, i.e. 4 % margin at best and a $16 loss per user at worst. Free's 200
// was up to $2.31/month for every signup that never pays.
//
// 400 (Pro) and 50 (Free) are what the price can actually carry: Pro costs
// ~$1.28 typical / $4.62 worst against ~$4.63 net revenue at 5 €, so it stays
// profitable even if every turn maxes out. See lib/pricing.ts for the full
// derivation and the marketed copy that has to agree with these numbers.
//
// Saving prompts to a project's Ergebnisse ("Prompt speichern") is deliberately
// unmetered: it makes no model call, it just keeps text the user already has,
// so there's no cost to ration. Only the project cap and the chat-message cap
// bind. (The old per-month "Generierungen" allowance died with the automatic
// generation pipeline, 2026-07.)
export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: { projects: 3, chatMessages: 50 },
  pro: { projects: Infinity, chatMessages: 400 },
  team: { projects: Infinity, chatMessages: 400 },
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
