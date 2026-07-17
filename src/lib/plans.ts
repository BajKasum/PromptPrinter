export type PlanKey = "free" | "pro" | "team";

export type PlanLimits = { projects: number; chatMessages: number };

// Marketed allowances per plan, the single source of truth for both the usage
// meters (settings, billing) and the server-side enforcement in /api/chat.
// `Infinity` means "no cap" (paid plans have unlimited projects).
//
// chatMessages counts assistant replies (one per turn) in the current calendar
// month; chat had no monthly cap at all until it was added, only an hourly rate
// limit (120/hr authed), so a free user with no BYOK key could chat all month
// on the server's own Z.ai key with no real ceiling. 200/month is generous for
// genuinely evaluating the product (~6-7 turns/day) while cutting the previous
// worst case (~86k/month via the rate limit alone) by roughly two orders of
// magnitude. Pro/team scale 10x. A user's own BYOK key (settings) bypasses this
// entirely, see /api/chat's override check.
//
// Saving prompts to a project's Ergebnisse ("Prompt speichern") is deliberately
// unmetered: it makes no model call, it just keeps text the user already has,
// so there's no cost to ration. Only the project cap and the chat-message cap
// bind. (The old per-month "Generierungen" allowance died with the automatic
// generation pipeline, 2026-07.)
export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: { projects: 3, chatMessages: 200 },
  pro: { projects: Infinity, chatMessages: 2000 },
  team: { projects: Infinity, chatMessages: 2000 },
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
