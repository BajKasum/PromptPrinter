/**
 * @startingPoint section="Feedback" subtitle="Labeled usage-vs-cap progress bar" viewport="420x140"
 */
export interface UsageMeterProps {
  label: string;
  used: number;
  /** Pass `Infinity` to render an "Unbegrenzt" (unlimited) meter. */
  limit: number;
}

export declare function UsageMeter(props: UsageMeterProps): JSX.Element;
