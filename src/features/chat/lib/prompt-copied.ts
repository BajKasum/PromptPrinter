"use client";

import { createContext, useContext } from "react";

// Meldet dem Ergebnis-Panel, dass der Prompt eben kopiert wurde (Finn feiert kurz, chat-result-panel.tsx). Ausserhalb
// eines Panels (ältere Antworten, Hilfe) ist der Wert null und das Kopieren bleibt still.
export const PromptCopiedContext = createContext<(() => void) | null>(null);

export function usePromptCopied(): () => void {
  const notify = useContext(PromptCopiedContext);
  return () => notify?.();
}
