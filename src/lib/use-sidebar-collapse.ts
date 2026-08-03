"use client";

import "client-only";

import { useCallback, useEffect, useState } from "react";

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
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return { collapsed, toggle };
}
