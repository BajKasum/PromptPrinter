import type { HTMLAttributes } from "react";

export type PlanKey = "free" | "pro" | "team";

/**
 * @startingPoint section="Core" subtitle="Uppercase mono pill + plan-tier badge" viewport="500x220"
 */
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Tint with the accent color instead of neutral surface. @default false */
  accent?: boolean;
}
export interface PlanBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  plan?: PlanKey;
  /** A role, not a plan — shows "Admin" instead of the tier and overrides `plan`. @default false */
  isAdmin?: boolean;
}

export declare function Badge(props: BadgeProps): JSX.Element;
export declare function PlanBadge(props: PlanBadgeProps): JSX.Element;
