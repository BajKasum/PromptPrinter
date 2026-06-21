"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type TargetAndTransition,
  type Transition,
} from "framer-motion";
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
}

type Preset = { animate: TargetAndTransition; transition: Transition };

// Idle-motion presets. Each loops gently and is skipped entirely under
// prefers-reduced-motion (the mascot then renders perfectly still). Durations
// and easings follow DESIGN.md — calm, never hectic.
const PRESETS: Record<Exclude<MascotMotion, "none">, Preset> = {
  float: {
    animate: { y: [0, -8, 0] },
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
  },
  lean: {
    animate: { rotate: [-2.5, 2.5, -2.5], y: [0, -3, 0] },
    transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
  },
  nod: {
    animate: { rotate: [-3, 3, -3] },
    transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
  },
  think: {
    animate: { y: [0, -4, 0], rotate: [-1.5, 1.5, -1.5] },
    transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" },
  },
  bob: {
    animate: { y: [0, -6, 0], rotate: [-4, 4, -4] },
    transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
  },
  cheer: {
    animate: { y: [0, -10, 0], rotate: [-4, 4, -4], scale: [1, 1.04, 1] },
    transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" },
  },
  peek: {
    animate: { x: [0, 4, 0], rotate: [-2, 2, -2] },
    transition: { duration: 3.4, repeat: Infinity, ease: "easeInOut" },
  },
  sigh: {
    animate: { y: [0, 3, 0] },
    transition: { duration: 4.4, repeat: Infinity, ease: "easeInOut" },
  },
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
}: AnimatedMascotProps) {
  const reduce = useReducedMotion() ?? false;
  const preset = motionOverride ?? MASCOT_STATES[state].motion;
  // Skip the idle loop entirely under reduced-motion or for the "none" preset.
  const anim = !reduce && preset !== "none" ? PRESETS[preset] : undefined;
  const swap = reduce ? 0 : 0.28;

  // Outer wrapper carries the idle loop + caller layout (hidden md:block,
  // mx-auto, shrink-0, …). Inner AnimatePresence crossfades on state change.
  return (
    <motion.div animate={anim?.animate} transition={anim?.transition} className={className}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={state}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: swap, ease: "easeOut" }}
        >
          <Mascot state={state} size={size} alt={alt} priority={priority} />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
