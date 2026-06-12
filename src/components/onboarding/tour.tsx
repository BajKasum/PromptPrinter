"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TourStep } from "@/components/onboarding/tour-steps";

type Rect = { top: number; left: number; width: number; height: number };

// Padding around the highlighted element and gap between target and tooltip.
const SPOT_PAD = 8;
const TIP_GAP = 14;
const EDGE = 16;

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const s = window.getComputedStyle(el);
  return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity || "1") > 0.05;
}

function findTarget(step: TourStep): HTMLElement | null {
  for (const sel of step.selectors ?? []) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el && isVisible(el)) return el;
  }
  return null;
}

/**
 * Guided product tour. Dims the page, spotlights one element per step and
 * explains it in a tooltip with progress + controls. Steps whose targets
 * don't exist in the current viewport (e.g. desktop sidebar on mobile) are
 * filtered out up front; if a target disappears mid-tour (resize), the step
 * is skipped on the fly.
 */
export function Tour({ steps: allSteps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const reduce = useReducedMotion();

  // Freeze the reachable steps once at mount — keeps the X/Y progress stable.
  const [steps] = useState<TourStep[]>(() =>
    allSteps.filter((s) => !s.selectors || findTarget(s) !== null)
  );
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [tipSize, setTipSize] = useState({ w: 340, h: 200 });

  const targetRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const step = steps[index];
  const last = index === steps.length - 1;

  const finish = useCallback(() => onClose(), [onClose]);

  const goto = useCallback(
    (from: number, dir: 1 | -1) => {
      let i = from + dir;
      while (i >= 0 && i < steps.length) {
        const s = steps[i];
        if (!s.selectors || findTarget(s)) {
          setIndex(i);
          return;
        }
        i += dir;
      }
      if (dir === 1) finish();
    },
    [steps, finish]
  );

  // Resolve the current step's target and bring it into view.
  useEffect(() => {
    if (!step) return;
    if (!step.selectors) {
      targetRef.current = null;
      return;
    }
    const el = findTarget(step);
    if (!el) {
      goto(index, 1);
      return;
    }
    targetRef.current = el;
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [index, step, goto, reduce]);

  // One tracking loop keeps the spotlight glued to its target through
  // scrolling, resizes and layout shifts, and keeps the viewport size fresh.
  useEffect(() => {
    const tick = () => {
      setVp((p) =>
        p.w === window.innerWidth && p.h === window.innerHeight
          ? p
          : { w: window.innerWidth, h: window.innerHeight }
      );
      const el = targetRef.current;
      if (!el || !el.isConnected) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect((p) =>
        p &&
        Math.abs(p.top - r.top) < 0.5 &&
        Math.abs(p.left - r.left) < 0.5 &&
        Math.abs(p.width - r.width) < 0.5 &&
        Math.abs(p.height - r.height) < 0.5
          ? p
          : { top: r.top, left: r.left, width: r.width, height: r.height }
      );
    };
    tick();
    const iv = window.setInterval(tick, 120);
    window.addEventListener("resize", tick);
    window.addEventListener("scroll", tick, true);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("resize", tick);
      window.removeEventListener("scroll", tick, true);
    };
  }, []);

  // Measure the tooltip so placement math uses its real size.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setTipSize((p) => (p.w === w && p.h === h ? p : { w, h }));
  }, [index, rect, vp]);

  // Keyboard: arrows navigate, Escape leaves the tour.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (last) finish();
        else goto(index, 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goto(index, -1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, last, goto, finish]);

  // Focus the tooltip on each step so screen readers announce it.
  useEffect(() => {
    const t = window.setTimeout(() => tipRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [index]);

  // Nothing reachable at all — never trap the user in an empty overlay.
  useEffect(() => {
    if (steps.length === 0) onClose();
  }, [steps.length, onClose]);

  // Before the first viewport tick there is nothing sensible to draw.
  if (!step || vp.w === 0) return null;

  const hasTarget = Boolean(step.selectors && rect);

  // Spotlight box (centered zero-size box when the step has no target, so the
  // dim layer stays seamless and the cutout morphs smoothly between steps).
  const spot: Rect = hasTarget
    ? {
        top: (rect as Rect).top - SPOT_PAD,
        left: (rect as Rect).left - SPOT_PAD,
        width: (rect as Rect).width + SPOT_PAD * 2,
        height: (rect as Rect).height + SPOT_PAD * 2,
      }
    : { top: vp.h / 2, left: vp.w / 2, width: 0, height: 0 };

  // Tooltip placement: phones get a bottom sheet; larger screens get a card
  // below the target (above when space is tight), clamped to the viewport.
  const sheet = vp.w < 640;
  let tipStyle: React.CSSProperties;
  if (sheet) {
    tipStyle = { left: 12, right: 12, bottom: 12 };
  } else if (!hasTarget) {
    tipStyle = {
      top: Math.max(EDGE, vp.h / 2 - tipSize.h / 2),
      left: Math.max(EDGE, vp.w / 2 - tipSize.w / 2),
    };
  } else {
    const below = spot.top + spot.height + TIP_GAP;
    const fitsBelow = below + tipSize.h + EDGE <= vp.h;
    const top = fitsBelow ? below : Math.max(EDGE, spot.top - tipSize.h - TIP_GAP);
    const left = Math.min(
      Math.max(EDGE, spot.left + spot.width / 2 - tipSize.w / 2),
      Math.max(EDGE, vp.w - tipSize.w - EDGE)
    );
    tipStyle = { top, left };
  }

  const progress = ((index + 1) / steps.length) * 100;
  const spring = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 320, damping: 32 };

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* Click shield — the dim layer is a box-shadow and catches no events,
          so this transparent layer keeps the page inert during the tour. */}
      <div className="absolute inset-0" aria-hidden="true" />

      {/* Spotlight cutout. The huge shadow dims everything around it. */}
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        transition={spring}
        className={cn(
          "absolute rounded-xl",
          hasTarget && "border-2 border-[#8FCDF2]/70 shadow-[0_0_0_4px_rgba(143,205,242,0.18),0_0_0_9999px_rgba(4,7,12,0.68)]",
          !hasTarget && "shadow-[0_0_0_9999px_rgba(4,7,12,0.68)]"
        )}
      />

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          ref={tipRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-step-title"
          tabIndex={-1}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
          transition={reduce ? { duration: 0.05 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={tipStyle}
          className={cn(
            "absolute rounded-2xl border border-border bg-surface-raised shadow-elevated focus:outline-none",
            sheet ? "p-5" : "w-[340px] p-5"
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-accent-text">
              Tour · {index + 1}/{steps.length}
            </span>
            <button
              type="button"
              onClick={finish}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              Überspringen
              <X className="h-3 w-3" strokeWidth={2} />
            </button>
          </div>

          <h2 id="tour-step-title" className="mb-1.5 text-[16px] font-semibold tracking-[-0.01em] text-foreground">
            {step.title}
          </h2>
          <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">{step.body}</p>

          {/* Progress bar */}
          <div className="mb-4 h-1 overflow-hidden rounded-full bg-surface">
            <motion.div
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={reduce ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-text"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => goto(index, -1)}
              disabled={index === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[13px] text-foreground/80 transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-40"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
              Zurück
            </button>
            <button
              type="button"
              onClick={() => (last ? finish() : goto(index, 1))}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-medium text-accent-foreground transition-all hover:bg-accent/90 active:scale-[0.97]"
            >
              {last ? (
                <>
                  <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  Beenden
                </>
              ) : (
                <>
                  Weiter
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
}
