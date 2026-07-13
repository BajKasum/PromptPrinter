import { cn } from "@/lib/utils";
import type { PlanKey } from "@/lib/plans";

// One pill style per plan, reused everywhere a plan is surfaced (Settings'
// Workspace card, Billing's header) so it never looks like two different
// components pretending to be the same affordance.
const PLAN_BADGE: Record<PlanKey, string> = {
  free: "border-border bg-surface text-foreground/70",
  pro: "border-accent/40 bg-accent-subtle text-accent-text",
  team: "border-cyan-400/40 bg-cyan-500/15 text-cyan-200",
};

export function PlanBadge({ plan, isAdmin = false }: { plan: PlanKey; isAdmin?: boolean }) {
  if (isAdmin) {
    return (
      <span className="shrink-0 rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-300">
        Admin
      </span>
    );
  }
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize",
        PLAN_BADGE[plan]
      )}
    >
      {plan}
    </span>
  );
}
