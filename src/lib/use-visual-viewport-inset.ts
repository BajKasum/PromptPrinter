"use client";

import { useEffect, useState } from "react";

/**
 * How much viewport height is currently hidden by an on-screen keyboard (or
 * any other visual-viewport shrink), in pixels. 0 when no keyboard is
 * showing, or the VisualViewport API isn't available (SSR — this always
 * returns 0 on the server, older browsers, or a platform where this isn't
 * an issue in the first place).
 *
 * QA finding K-1: `sticky bottom-0` positions against the LAYOUT viewport.
 * `interactive-widget=resizes-content` (see layout.tsx's viewport export)
 * asks the browser to resize the layout viewport itself when the keyboard
 * opens, which is enough on Chrome/Android — but iOS Safari doesn't
 * reliably follow that for `dvh`/sticky the same way, the well-known "chat
 * input floats mid-screen or hides behind the keyboard" bug. Reading
 * window.visualViewport directly and pushing the composer up by exactly the
 * keyboard's height is the standard workaround, keeping it pinned just
 * above the keyboard instead of wherever the layout viewport thinks the
 * bottom of the screen is.
 *
 * Unverified on a real iOS device (none available in this environment) —
 * the finding is explicit that this specific bug does not reproduce in an
 * emulator, so this needs a real-device check before being called fixed.
 */
export function useVisualViewportInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function update() {
      if (!vv) return;
      // window.innerHeight is the layout viewport, vv.height shrinks as the
      // keyboard opens; the difference is the keyboard's height. vv.offsetTop
      // covers the (rarer) case where the visual viewport is also scrolled
      // within the layout viewport, e.g. while pinch-zoomed.
      setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    }

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
