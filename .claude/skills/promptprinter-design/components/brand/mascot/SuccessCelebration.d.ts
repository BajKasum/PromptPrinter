/**
 * @startingPoint section="Brand" subtitle="Full-screen confetti + Finn, every success moment" viewport="500x420"
 */
export interface SuccessCelebrationProps {
  /** Headline, e.g. "Erfolgreich eingeloggt". */
  message: string;
  /** Optional second line. */
  description?: string;
  /** Called once the celebration is over — use it to navigate/dismiss. */
  onDone?: () => void;
  /** How long the overlay stays before calling onDone (ms). @default 2200 */
  durationMs?: number;
  /** Relative path from the consuming page to assets/mascot. @default "../../../assets/mascot" */
  assetsBase?: string;
  className?: string;
}

export declare function SuccessCelebration(props: SuccessCelebrationProps): JSX.Element;
