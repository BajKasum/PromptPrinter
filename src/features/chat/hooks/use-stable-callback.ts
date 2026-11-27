"use client";

import "client-only";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Eine Funktion mit gleichbleibender Identität, die immer die Fassung des letzten Renders ausführt. Für Rückrufe an
 * `memo`-Komponenten: eine neue Funktion je Render zeichnete sie jedes Mal neu, eine mit festen Abhängigkeiten sähe
 * einen veralteten Stand. Nur aus Ereignissen aufrufen, nie während des Renderns.
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn);
  useLayoutEffect(() => {
    latest.current = fn;
  });
  return useCallback((...args: A) => latest.current(...args), []);
}
