export interface FloaterSpec {
  kind: "star" | "bubble";
  top: string;
  left: string;
  size: number;
  delay: number;
  duration: number;
}
/**
 * @startingPoint section="Brand" subtitle="Ambient drifting bubbles + sparks" viewport="700x260"
 */
export interface FloatersProps {
  items: FloaterSpec[];
}

export declare function Floaters(props: FloatersProps): JSX.Element;
export declare const FLOATER_PRESETS: { hero: FloaterSpec[]; section: FloaterSpec[] };
