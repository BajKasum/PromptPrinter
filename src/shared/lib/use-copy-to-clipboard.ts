"use client";

import "client-only";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/shared/i18n/provider";
import { useOptionalToast } from "@/shared/ui/toast-context";

/**
 * Text in die Zwischenablage legen, mit einem kurzen "Kopiert" danach. Fehlt `navigator.clipboard` (per http im
 * Heimnetz) oder lehnt der Browser ab (Fenster nicht im Fokus, Recht verweigert), geht der Weg über eine Auswahl.
 * Scheitert auch der, sagt es ein Toast; wo es keinen gibt (öffentliche Seiten), liest der Aufrufer `failed` und sagt
 * es selbst. Der Aufruf wirft nie.
 */
export function useCopyToClipboard(resetDelayMs = 1500) {
  const t = useT();
  const toasts = useOptionalToast();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  // Zählt jedes gelungene Kopieren, auch während `copied` noch steht: die Animation (CopyMoment) beginnt so beim
  // schnellen zweiten Klick neu.
  const [copyCount, setCopyCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  /** true, wenn der Text in der Zwischenablage liegt. `quiet`: kein Toast, der Aufrufer sagt das Ergebnis selbst. */
  async function copy(text: string, { quiet = false }: { quiet?: boolean } = {}): Promise<boolean> {
    setFailed(false);
    const ok = await writeToClipboard(text);
    // Inzwischen ausgehängt: nichts mehr zeigen und keinen Timer starten.
    if (!mounted.current) return ok;
    // Der Timer eines früheren Klicks würde "Kopiert" dem neuen sonst zu früh wegnehmen.
    clearTimeout(timer.current);
    setCopied(ok);
    if (ok) {
      setCopyCount((n) => n + 1);
      timer.current = setTimeout(() => setCopied(false), resetDelayMs);
    } else {
      setFailed(true);
      if (!quiet) {
        toasts?.toast({ title: t.common.copyFailed, description: t.common.copyFailedHint, variant: "error" });
      }
    }
    return ok;
  }

  return { copied, failed, copy, copyCount };
}

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    // Ohne sicheren Kontext gibt es navigator.clipboard nicht, der Zugriff wirft dann sofort.
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyBySelection(text);
  }
}

/** Der Weg ohne Clipboard-API: ein Feld ausserhalb der Sicht markieren und den Browser kopieren lassen. */
function copyBySelection(text: string): boolean {
  const previous = document.activeElement;
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.setAttribute("aria-hidden", "true");
  // Mit Fläche, aber durchsichtig: ein verstecktes Feld lässt sich nicht markieren.
  field.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
  document.body.appendChild(field);
  try {
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
    if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
  }
}
