export interface ToolVisual {
  color: string;
  blurb: string;
}

/**
 * @startingPoint section="Brand" subtitle="Inline brand marks for every build-target tool" viewport="700x260"
 */
export interface ToolLogoProps {
  name: string;
  size?: number;
  className?: string;
}
export declare function ToolLogo(props: ToolLogoProps): JSX.Element;
export declare function toolVisual(name: string): ToolVisual;
export declare const TOOL_VISUAL: Record<string, ToolVisual>;
