import type { ImgHTMLAttributes } from "react";

export type MascotState =
  | "idle" | "welcoming" | "curious" | "listening" | "thinking" | "researching"
  | "building" | "organizing" | "explaining" | "delivering" | "celebrating"
  | "helping" | "waiting" | "sad";

export type MascotMotion = "float" | "lean" | "nod" | "think" | "bob" | "cheer" | "peek" | "sigh";

/**
 * @startingPoint section="Brand" subtitle="Finn, the 14-state dolphin mascot" viewport="800x420"
 */
export interface MascotProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** Rendered width & height in px (source art is square). @default 96 */
  size?: number;
  /** Resolves artwork via MASCOT_STATES (preferred over `src`). */
  state?: MascotState;
  /** Manual artwork override. Wins over `state`. */
  src?: string;
  /** Relative path from the consuming page to assets/mascot. @default "../../../assets/mascot" */
  assetsBase?: string;
  /** Above-the-fold placements should set this to skip lazy-loading. @default false */
  priority?: boolean;
}

export interface AnimatedMascotProps extends MascotProps {
  /** Override the state's default idle-motion preset. */
  motion?: MascotMotion;
}

export declare function Mascot(props: MascotProps): JSX.Element;
export declare function AnimatedMascot(props: AnimatedMascotProps): JSX.Element;
export declare const MASCOT_STATES: Record<MascotState, { file: string; alt: string; motion: MascotMotion }>;
