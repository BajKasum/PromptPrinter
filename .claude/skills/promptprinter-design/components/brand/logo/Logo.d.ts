/**
 * @startingPoint section="Brand" subtitle="Dolphin mark + wordmark lockup" viewport="500x160"
 */
export interface LogoProps {
  className?: string;
  /** Dolphin height in px; the wordmark scales with it. @default 28 */
  size?: number;
  /** Render only the dolphin mark, without the wordmark. @default false */
  iconOnly?: boolean;
  /** Two-tone wordmark ("Prompt" in accent, "Printer" in foreground). @default false */
  accentWordmark?: boolean;
  /** Animate the wordmark away, leaving just the mark (scroll-driven navbars). Omit for the plain lockup. */
  collapsed?: boolean;
  /** Relative path from the consuming page to assets/mascot. @default "../../../assets/mascot" */
  assetsBase?: string;
  style?: React.CSSProperties;
}
export interface LogoMarkProps {
  size?: number;
  assetsBase?: string;
  className?: string;
}

export declare function Logo(props: LogoProps): JSX.Element;
export declare function LogoMark(props: LogoMarkProps): JSX.Element;
