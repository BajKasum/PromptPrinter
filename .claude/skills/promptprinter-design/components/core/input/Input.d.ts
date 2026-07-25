import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * @startingPoint section="Core" subtitle="Text field + textarea, default/focus/error/disabled" viewport="500x420"
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Shows the destructive-border error state. @default false */
  error?: boolean;
}
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export declare function Input(props: InputProps): JSX.Element;
export declare function Textarea(props: TextareaProps): JSX.Element;
