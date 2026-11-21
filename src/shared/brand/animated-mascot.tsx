"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { Mascot } from "./mascot";
import { MASCOT_STATES, type MascotMotion, type MascotState } from "./mascot-states";

interface AnimatedMascotProps {
  state: MascotState;
  size?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
  /** Override the state's default motion preset. */
  motion?: MascotMotion;
  /** Passed through to <Mascot>, see there. */
  sizes?: string;
}

/**
 * Die Leerlauf-Bewegung je Preset als Klasse; Keyframes, Dauer und Easing stehen in app/globals.css
 * (`.finn-idle-*`, ruhig wie in DESIGN.md). Eine CSS-Animation auf `transform` läuft im Compositor: Finn
 * bewegt sich, ohne dass der Hauptthread je Bild rechnet, auch während die Seite hydriert. Unter
 * prefers-reduced-motion steht er still (Media Query in derselben Datei).
 */
export const IDLE_CLASS: Record<Exclude<MascotMotion, "none">, string> = {
  float: "finn-idle-float",
  lean: "finn-idle-lean",
  nod: "finn-idle-nod",
  think: "finn-idle-think",
  bob: "finn-idle-bob",
  cheer: "finn-idle-cheer",
  peek: "finn-idle-peek",
  sigh: "finn-idle-sigh",
};

/**
 * Finn with his state's idle animation. Use on landing-page / hero placements
 * where the mascot should feel alive. When `state` changes the artwork
 * crossfades, so a reactive Finn (e.g. the hero demo) morphs smoothly between
 * poses. Reduced-motion users get an instant swap and no idle loop. The
 * animation is transform/opacity only, so it never shifts layout.
 */
export function AnimatedMascot({
  state,
  size = 96,
  className,
  alt = "",
  priority = false,
  motion: motionOverride,
  sizes,
}: AnimatedMascotProps) {
  const reduce = useReducedMotion() ?? false;
  const preset = motionOverride ?? MASCOT_STATES[state].motion;
  const swap = reduce ? 0 : 0.28;

  // Outer wrapper carries the idle loop + caller layout (hidden md:block,
  // mx-auto, shrink-0, …). Inner AnimatePresence crossfades on state change.
  return (
    <div className={cn(preset !== "none" && IDLE_CLASS[preset], className)}>
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={state}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: swap, ease: "easeOut" }}
        >
          <Mascot state={state} size={size} alt={alt} priority={priority} sizes={sizes} />
        </m.div>
      </AnimatePresence>
    </div>
  );
}
