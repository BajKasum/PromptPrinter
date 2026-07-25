import React from "react";

/**
 * Finn's 14-state registry — filenames under assets/mascot (see readme →
 * Iconography). `assetsBase` should be the relative path from the consuming
 * page to that folder (defaults match this component's own card depth).
 */
export const MASCOT_STATES = {
  idle: { file: "dolphin.png", alt: "Finn, der PromptPrinter-Delfin", motion: "float" },
  welcoming: { file: "dolphin-welcoming.png", alt: "Finn winkt dir zur Begrüßung zu", motion: "float" },
  curious: { file: "dolphin-curious.png", alt: "Finn ist neugierig auf deine Idee", motion: "lean" },
  listening: { file: "dolphin-listening.png", alt: "Finn hört dir aufmerksam zu", motion: "nod" },
  thinking: { file: "dolphin-thinking.png", alt: "Finn denkt über deine Idee nach", motion: "think" },
  researching: { file: "dolphin-researching.png", alt: "Finn recherchiert die passenden Tools", motion: "lean" },
  building: { file: "dolphin-building.png", alt: "Finn baut dein Projekt", motion: "float" },
  organizing: { file: "dolphin-organizing.png", alt: "Finn sortiert alles zu einem Paket", motion: "float" },
  explaining: { file: "dolphin-explaining.png", alt: "Finn erklärt dir das Ergebnis", motion: "lean" },
  delivering: { file: "dolphin-delivering.png", alt: "Finn übergibt dir dein fertiges Bau-Paket", motion: "float" },
  celebrating: { file: "dolphin-celebrating.png", alt: "Finn feiert mit dir", motion: "cheer" },
  helping: { file: "dolphin-helping.png", alt: "Finn streckt dir helfend die Flosse hin", motion: "peek" },
  waiting: { file: "dolphin-waiting.png", alt: "Finn wartet geduldig", motion: "bob" },
  sad: { file: "dolphin-sad.png", alt: "Finn ist betrübt", motion: "sigh" },
};

const MOTION_DURATION = { float: 4, lean: 5, nod: 1.8, think: 3.2, bob: 2.6, cheer: 1.4, peek: 3.4, sigh: 4.4 };

/**
 * Finn, the PromptPrinter dolphin — static artwork. Prefer `state` (resolved
 * through MASCOT_STATES) so artwork stays centralized; `src` is a manual
 * override. For idle animation use <AnimatedMascot> instead.
 */
export function Mascot({ size = 96, className = "", alt = "", priority = false, state, src, assetsBase = "../../../assets/mascot", style, ...props }) {
  const resolved = src ?? `${assetsBase}/${state ? MASCOT_STATES[state].file : "dolphin.png"}`;
  const resolvedAlt = alt || (state ? MASCOT_STATES[state].alt : "");
  return (
    <img
      src={resolved}
      width={size}
      height={size}
      alt={alt === undefined ? resolvedAlt : alt}
      loading={priority ? "eager" : "lazy"}
      className={className}
      style={{ userSelect: "none", display: "inline-block", ...style }}
      {...props}
    />
  );
}

/**
 * Finn with his state's idle animation (gentle, spring-like, never hectic —
 * see DESIGN.md → Finn's World, "Finn-Physik"). Respects
 * prefers-reduced-motion globally via tokens/motion.css. Requires styles.css
 * linked (uses the pp-float/pp-lean/… keyframes it defines).
 */
export function AnimatedMascot({ state, size = 96, className = "", alt = "", priority = false, motion, assetsBase, style, ...props }) {
  const preset = motion || MASCOT_STATES[state]?.motion || "float";
  const duration = MOTION_DURATION[preset] || 4;
  return (
    <Mascot
      state={state}
      size={size}
      alt={alt}
      priority={priority}
      assetsBase={assetsBase}
      className={className}
      style={{ animation: `pp-${preset} ${duration}s ease-in-out infinite`, ...style }}
      {...props}
    />
  );
}
