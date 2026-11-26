"use client";

import { createContext, useContext } from "react";

// Der Zugang zu den Toasts, getrennt von toast.tsx: wer nur meldet, lädt nicht die Anzeige samt Maskottchen und
// Bewegung mit, auch nicht auf öffentlichen Seiten, die keinen ToastProvider haben.

export type ToastVariant = "default" | "success" | "error";

export type ToastInput = { title: string; description?: string; variant?: ToastVariant };

export type ToastContextValue = { toast: (t: ToastInput) => void };

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

/** Wie useToast, ohne Provider aber null: für Bausteine, die auch auf öffentlichen Seiten stehen. */
export function useOptionalToast(): ToastContextValue | null {
  return useContext(ToastContext);
}
