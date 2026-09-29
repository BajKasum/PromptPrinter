import { de, type Messages } from "@/shared/i18n/messages/de";
import { fmt } from "@/shared/i18n/format";

// There is one chat (REDESIGN.md, Phase 2), no mode choice at the start.
// Only refining a project's packet is its own context.
//
// QA finding C-2: this used to also carry a "software" value, mirroring the
// legacy conversations.mode column (dropped in migration 0024) — but it
// mapped to the exact same empty state as "general", so it never changed
// anything this function returned. Removed along with the column and the
// `mode`/`ChatMode` parameter that only ever fed it.
export type Variant = "general" | "refine";

// A project chat is its own context; every standalone chat is the one
// unified chat.
export function resolveVariant(projectId: string | undefined): Variant {
  return projectId ? "refine" : "general";
}

export type ResolvedEmptyState = { heading: string; placeholder: string };

// Just Finn's opening line, no subtext or starter suggestions, Finn is the
// whole empty state. Inside a project the copy depends on whether results
// exist: refining a saved prompt vs. doing the project's first work (a
// project chat before any result exists is where the project's first work
// happens, briefed by the context rail). `name` (the user's display name, or
// undefined if unset) personalizes only the unified greeting, "Woran arbeiten
// wir, Kasum?", the project/refine headings read fine as-is and stay
// untouched.
//
// Die Texte kommen seit 29.09.2026 aus dem Wörterbuch der aktiven Sprache
// (`m`); ohne Angabe Deutsch, wie vorher.
export function resolveEmptyState(
  variant: Variant,
  hasResults: boolean,
  name?: string | null,
  m: Messages["chat"] = de.chat
): ResolvedEmptyState {
  if (variant === "refine") {
    return hasResults
      ? { heading: m.emptyRefine, placeholder: m.placeholderRefine }
      : { heading: m.emptyProject, placeholder: m.placeholder };
  }
  return {
    heading: name ? fmt(m.emptyHeadingNamed, { name }) : m.emptyHeading,
    placeholder: m.placeholder,
  };
}
