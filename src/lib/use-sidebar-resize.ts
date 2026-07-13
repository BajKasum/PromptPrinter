"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// Split out of sidebar.tsx: this is the drag-to-resize interaction (pointer
// capture, keyboard nudging, cookie persistence, drag-scoped text-selection
// suppression) — none of it is rendering.
//
// User-resizable width (drag handle on the trailing edge, see sidebar.tsx's
// `aside`). Bounds keep it from ever feeling broken: narrow enough to stop
// being useful below MIN, wide enough to start eating the main content above
// MAX. Persisted the same way as the collapsed flag — a cookie the server
// layout reads for the first paint, so there's no flash/jump on load.
export const SIDEBAR_WIDTH_COOKIE = "pp-sidebar-width";
export const MIN_SIDEBAR_WIDTH = 220;
export const MAX_SIDEBAR_WIDTH = 380;
export const DEFAULT_SIDEBAR_WIDTH = 264;
const KEYBOARD_STEP = 16;

function clampWidth(w: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, w));
}

export function useSidebarResize(initialWidth: number) {
  const [width, setWidth] = useState(() => clampWidth(initialWidth));
  // True only while the handle is actively being dragged — suppresses the
  // collapse/expand transition so the width tracks the pointer with zero lag,
  // and lights up the handle's visual line.
  const [dragging, setDragging] = useState(false);

  function persistWidth(w: number) {
    document.cookie = `${SIDEBAR_WIDTH_COOKIE}=${Math.round(w)}; path=/; max-age=31536000; samesite=lax`;
  }

  // Drag-to-resize via Pointer Events + capture: one element gets every
  // move/up regardless of what the cursor crosses, so there's no window-
  // listener bookkeeping and touch works the same as mouse. Only the width
  // state changes while dragging — the cookie is written once, on release,
  // not on every pixel of movement.
  const dragStart = useRef<{ x: number; width: number } | null>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragStart.current = { x: e.clientX, width };
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [width]
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    setWidth(clampWidth(dragStart.current.width + (e.clientX - dragStart.current.x)));
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    setWidth((w) => {
      persistWidth(w);
      return w;
    });
  }, []);

  const onKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setWidth((w) => {
      const next = clampWidth(w + (e.key === "ArrowRight" ? KEYBOARD_STEP : -KEYBOARD_STEP));
      persistWidth(next);
      return next;
    });
  }, []);

  // Native browser text-selection would otherwise highlight page content
  // while dragging across it — this is the standard fix, scoped to the drag.
  useEffect(() => {
    if (!dragging) return;
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = prev;
    };
  }, [dragging]);

  return { width, dragging, onPointerDown, onPointerMove, onPointerUp, onKeyDown };
}
