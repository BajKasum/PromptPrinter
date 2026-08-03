export type PlanKey = "free" | "pro" | "team";

export type PlanLimits = { projects: number; chatMessages: number };

// Marketed allowances per plan, the single source of truth for both the usage
// meters (settings, billing) and the server-side enforcement in /api/chat.
// `Infinity` means "no cap" (paid plans have unlimited projects).
//
// chatMessages counts assistant replies (one per turn) in the current calendar
// month, ONLY on the server's own provider key — a user's own BYOK key
// (settings) bypasses this entirely, see /api/chat's override check. That
// distinction is now the whole point of Free, see below.
//
// ─── Re-costed 2026-07-29, re-priced 2026-07-30, re-modelled 2026-07-30 ──
// 2026-07-29: the original numbers (Free 200, Pro/Team 2000 at 7 €) were
// picked as "generous, and far below the previous worst case" without ever
// being checked against what a turn actually costs. They didn't survive that
// check — see git history for the full math. First correction landed on
// Free 50 / Pro 400 at 5 €, the smallest price that still broke even on a
// worst-case month. A same-day follow-up moved to Free 25 / Pro 350 at 5,90 €
// on product grounds (keep Free's per-signup cost minimal, make Pro a clear
// step up) — still charging the operator's own key for every Free account.
//
// 2026-07-30 (second pass, same day): a solo, self-funded operator can't
// carry ANY structural per-signup cost right now, however small. `free.
// chatMessages = 0` is not a rounding-down of the free allowance, it is the
// removal of Free's access to the server's own key entirely — Free now
// requires a BYOK key to chat at all (see api/chat/route.ts's dedicated
// early-return for this exact state, and lib/pricing.ts's marketed copy,
// which leads with the BYOK requirement rather than a message count).
// This isn't a workaround for `chatMessages: 0`, it's the intended state: a
// signed-up account with no BYOK key and plan "free" is correctly, permanently
// unable to spend the operator's model budget, by construction, not by a
// limit that merely happens to be small.
//
// Pro moves 350 → 400: with Free now contributing zero server-key cost,
// there's no structural cost pressure pushing Pro's allowance down, so it
// goes to the roundest generous number the same 5,90 €/month price still
// covers comfortably — see lib/pricing.ts for the per-plan margin math
// (still solidly profitable even in the code's own worst-case scenario, not
// just on average).
//
// Saving prompts to a project's Ergebnisse ("Prompt speichern") is deliberately
// unmetered: it makes no model call, it just keeps text the user already has,
// so there's no cost to ration. Only the project cap and the chat-message cap
// bind. (The old per-month "Generierungen" allowance died with the automatic
// generation pipeline, 2026-07.)
export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: { projects: 3, chatMessages: 0 },
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
