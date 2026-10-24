import { cn } from "@/shared/lib/utils";
import type { PlanKey } from "@/shared/lib/plans";

// One pill style per plan, reused everywhere a plan is surfaced (Settings'
// Workspace card, Billing's header) so it never looks like two different
// components pretending to be the same affordance.
const PLAN_BADGE: Record<PlanKey, string> = {
  free: "border-border bg-surface text-foreground/70",
  pro: "border-accent/40 bg-accent-subtle text-accent-text",
};

export function PlanBadge({ plan, isAdmin = false }: { plan: PlanKey; isAdmin?: boolean }) {
  if (isAdmin) {
    return (
      <span className="shrink-0 rounded-full border border-warning/40 bg-warning/15 px-2.5 py-1 text-[12px] font-medium text-warning">
        Admin
      </span>
    );
  }
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-medium capitalize",
        PLAN_BADGE[plan]
      )}
    >
      {plan}
    </span>
  );
}
