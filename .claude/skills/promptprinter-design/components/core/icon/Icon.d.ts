import type { CSSProperties } from "react";

/**
 * @startingPoint section="Core" subtitle="Dependency-free line icon set" viewport="640x360"
 */
export interface IconProps {
  /** Kebab-case glyph name, see ICON_NAMES for the full list. */
  name: string;
  /** Pixel size (square). Default 16. */
  size?: number;
  /** Stroke weight. Default 1.8 (the product's standard). */
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible name; omit for decorative use (default). */
  title?: string;
}

export declare function Icon(props: IconProps): JSX.Element | null;
export declare function IconSpinKeyframes(): JSX.Element;
export declare const ICON_NAMES: string[];
