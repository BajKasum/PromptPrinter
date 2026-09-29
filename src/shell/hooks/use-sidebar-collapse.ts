"use client";

import "client-only";

import { useCallback, useEffect, useState } from "react";
import { matchesShortcut } from "@/shell/lib/shortcuts";

// The sidebar's collapse state persists in a cookie so the server-rendered
// layout knows it on first paint, no flash/snap after hydration (see
// src/app/(app)/layout.tsx). Split out of sidebar.tsx: this is interaction
// logic (state + a global keyboard shortcut), not rendering.
export const SIDEBAR_COOKIE = "pp-sidebar";

export function useSidebarCollapse(initialCollapsed: boolean) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  // Ctrl/⌘+B toggles the sidebar from anywhere, mirroring the ⌘K palette.
  // Exakt, ohne Shift/Alt: Strg+Shift+B ist seit 29.09.2026 "Abrechnung"
  // (shell/lib/shortcuts.ts), und Strg+Alt+B ist unter Windows AltGr+B.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (matchesShortcut(e, { key: "b", shift: false })) {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return { collapsed, toggle };
}
