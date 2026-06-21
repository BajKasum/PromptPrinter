import Image from "next/image";
import { cn } from "@/lib/utils";
import { MASCOT_STATES, type MascotState } from "./mascot-states";

interface MascotProps {
  /** Rendered width & height in px (the source PNG is square). Default 96. */
  size?: number;
  className?: string;
  /**
   * Decorative by default (empty alt) — the mascot usually sits next to real
   * copy, so a screen reader announcing it would just be noise. Pass an alt
   * (or use the state's `alt` from the registry) only when Finn stands alone.
   */
  alt?: string;
  /** Set on above-the-fold placements (e.g. an empty state) to skip lazy-load. */
  priority?: boolean;
  /** Mascot state — resolves artwork via the state registry (preferred). */
  state?: MascotState;
  /** Manual artwork override (e.g. /mascot/dolphin-sad.png). Wins over `state`. */
  src?: string;
}

/**
 * Finn, the PromptPrinter dolphin. Prefer `state` (resolved through
 * [mascot-states.ts]) so artwork stays centralized; `src` remains for one-off
 * overrides. Routed through next/image, so the heavy source PNG is served
 * resized/optimized per usage. For idle animation, wrap with <AnimatedMascot>.
 */
export function Mascot({
  size = 96,
  className,
  alt = "",
  priority = false,
  state,
  src,
}: MascotProps) {
  const resolvedSrc = src ?? (state ? MASCOT_STATES[state].src : "/mascot/dolphin.png");

  return (
    <Image
      src={resolvedSrc}
      width={size}
      height={size}
      alt={alt}
      priority={priority}
      className={cn("select-none", className)}
    />
  );
}
