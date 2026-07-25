import type { SVGProps } from "react";

/**
 * @startingPoint section="Navigation" subtitle="Animated hamburger ⇆ close morph icon" viewport="300x160"
 */
export interface MenuToggleIconProps extends SVGProps<SVGSVGElement> {
  /** When true, morphs into a close (X) state. */
  open: boolean;
  /** Transition duration in ms. @default 300 */
  duration?: number;
}

export declare function MenuToggleIcon(props: MenuToggleIconProps): JSX.Element;
