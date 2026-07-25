import type { ReactNode } from "react";

export type ToastVariant = "default" | "success" | "error";
export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
}
export interface ToastProviderProps {
  children?: ReactNode;
  /** Relative path from the consuming page to assets/mascot. @default "../../../assets/mascot" */
  mascotBase?: string;
}

/**
 * @startingPoint section="Feedback" subtitle="Toast notifications with Finn for success/error" viewport="500x220"
 */
export declare function ToastProvider(props: ToastProviderProps): JSX.Element;
export declare function useToast(): { toast: (t: ToastInput) => void };
