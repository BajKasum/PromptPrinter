"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastInput = { title: string; description?: string; variant?: ToastVariant };

type ToastContextValue = { toast: (t: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const VARIANTS: Record<ToastVariant, { Icon: typeof Info; accent: string }> = {
  default: { Icon: Info, accent: "text-accent-text" },
  success: { Icon: CheckCircle2, accent: "text-success" },
  error: { Icon: AlertCircle, accent: "text-destructive" },
};

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "default" }: ToastInput) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      window.setTimeout(() => remove(id), AUTO_DISMISS_MS);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const { Icon, accent } = VARIANTS[t.variant];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-surface-raised/95 px-4 py-3 shadow-elevated backdrop-blur-xl"
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", accent)} strokeWidth={1.8} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-foreground">{t.title}</p>
                  {t.description && (
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">{t.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  aria-label="Benachrichtigung schliessen"
                  className="shrink-0 text-muted-foreground transition-colors hover:text-foreground active:scale-90"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
