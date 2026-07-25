/**
 * @startingPoint section="Brand" subtitle="Swimming Finn + rising bubbles, for any loading state" viewport="300x120"
 */
export interface DolphinLoaderProps {
  /** Box size in px. @default 36 */
  size?: number;
  /** Optional text to the right of the dolphin (e.g. "Schreibt…"). */
  label?: string;
  /** Relative path from the consuming page to assets/mascot. @default "../../../assets/mascot" */
  assetsBase?: string;
  className?: string;
}

export declare function DolphinLoader(props: DolphinLoaderProps): JSX.Element;
