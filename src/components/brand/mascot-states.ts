/**
 * Finn — the PromptPrinter dolphin mascot — as a finite state system.
 *
 * Single source of truth for "which artwork + which idle animation" each mascot
 * state uses. Swap a PNG here (or retrain the look) and it changes everywhere.
 * See MASCOT.md for the full system: where each state appears, the user emotion
 * it supports and the business goal it serves.
 *
 * Artwork lives at /public/mascot/dolphin-<state>.png (transparent square PNG).
 */

export type MascotState =
  | "idle"
  | "welcoming"
  | "curious"
  | "listening"
  | "thinking"
  | "researching"
  | "building"
  | "organizing"
  | "explaining"
  | "delivering"
  | "celebrating"
  | "helping"
  | "waiting"
  | "sad";

/** Named idle-motion presets (implemented in animated-mascot.tsx). */
export type MascotMotion =
  | "none"
  | "float" // gentle vertical bob — welcoming / idle
  | "lean" // slow inquisitive tilt — curious / explaining / researching
  | "nod" // attentive nodding — listening
  | "think" // slow drift while pondering — thinking
  | "bob" // swim-bob + sway — waiting
  | "cheer" // energetic hop + wiggle — celebrating
  | "peek" // small supportive nudge — helping
  | "sigh"; // slow downward settle — sad

export interface MascotStateDef {
  /** Artwork path under /public. */
  src: string;
  /** Meaningful label for standalone placements (decorative usage passes alt=""). */
  alt: string;
  /** Default idle animation for this state. */
  motion: MascotMotion;
}

export const MASCOT_STATES: Record<MascotState, MascotStateDef> = {
  idle: {
    src: "/mascot/dolphin.png",
    alt: "Finn, der PromptPrinter-Delfin",
    motion: "float",
  },
  welcoming: {
    src: "/mascot/dolphin-welcoming.png",
    alt: "Finn winkt dir zur Begrüßung zu",
    motion: "float",
  },
  curious: {
    src: "/mascot/dolphin-curious.png",
    alt: "Finn ist neugierig auf deine Idee",
    motion: "lean",
  },
  listening: {
    src: "/mascot/dolphin-listening.png",
    alt: "Finn hört dir aufmerksam zu",
    motion: "nod",
  },
  thinking: {
    src: "/mascot/dolphin-thinking.png",
    alt: "Finn denkt über deine Idee nach",
    motion: "think",
  },
  researching: {
    src: "/mascot/dolphin-researching.png",
    alt: "Finn recherchiert die passenden Tools",
    motion: "lean",
  },
  building: {
    src: "/mascot/dolphin-building.png",
    alt: "Finn baut dein Projekt",
    motion: "float",
  },
  organizing: {
    src: "/mascot/dolphin-organizing.png",
    alt: "Finn sortiert alles zu einem Paket",
    motion: "float",
  },
  explaining: {
    src: "/mascot/dolphin-explaining.png",
    alt: "Finn erklärt dir das Ergebnis",
    motion: "lean",
  },
  delivering: {
    src: "/mascot/dolphin-delivering.png",
    alt: "Finn übergibt dir dein fertiges Bau-Paket",
    motion: "float",
  },
  celebrating: {
    src: "/mascot/dolphin-celebrating.png",
    alt: "Finn feiert mit dir",
    motion: "cheer",
  },
  helping: {
    src: "/mascot/dolphin-helping.png",
    alt: "Finn streckt dir helfend die Flosse hin",
    motion: "peek",
  },
  waiting: {
    src: "/mascot/dolphin-waiting.png",
    alt: "Finn wartet geduldig",
    motion: "bob",
  },
  sad: {
    src: "/mascot/dolphin-sad.png",
    alt: "Finn ist betrübt",
    motion: "sigh",
  },
};
