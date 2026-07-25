import type { ReactNode, ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "accent" | "ghost" | "outline" | "subtle" | "destructive" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

/**
 * @startingPoint section="Core" subtitle="Primary, accent, ghost, outline, subtle, destructive, link" viewport="700x360"
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * @default "primary"
   */
  variant?: ButtonVariant;
  /**
   * @default "md"
   */
  size?: ButtonSize;
  /** Render the button's style onto a single child element instead of a <button>. */
  asChild?: boolean;
  children?: ReactNode;
}

export declare function Button(props: ButtonProps): JSX.Element;
