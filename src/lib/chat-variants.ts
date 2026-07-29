// There is one chat (REDESIGN.md, Phase 2), no mode choice at the start.
// Only refining a project's packet is its own context.
//
// QA finding C-2: this used to also carry a "software" value, mirroring the
// legacy conversations.mode column (dropped in migration 0024) — but it
// mapped to the exact same EmptyConfig as "general" below, so it never
// changed anything this function returned. Removed along with the column
// and the `mode`/`ChatMode` parameter that only ever fed it.
export type Variant = "general" | "refine";

type EmptyConfig = { heading: string };

// Just Finn's opening line, no subtext or starter suggestions, Finn is the
// whole empty state. No trailing "?" here, resolveEmptyState below adds it
// after an optional ", {name}" so both read as one clean question.
const UNIFIED_EMPTY: EmptyConfig = { heading: "Woran arbeiten wir" };

const VARIANTS: Record<Variant, EmptyConfig> = {
  general: UNIFIED_EMPTY,
  refine: { heading: "Pass deine Prompts an" },
};

// A project chat before any result exists: nothing to refine yet, the chat
// is where the project's first work happens, briefed by the context rail.
const PROJECT_FRESH: EmptyConfig = { heading: "Woran arbeiten wir hier?" };

// A project chat is its own context; every standalone chat is the one
// unified chat.
export function resolveVariant(projectId: string | undefined): Variant {
  return projectId ? "refine" : "general";
}

export type ResolvedEmptyState = { heading: string; placeholder: string };

// Inside a project the copy depends on whether results exist: refining a
// saved packet/prompt vs. doing the project's first work. `name` (the
// user's display name, or undefined if unset) personalizes only the unified
// greeting, "Woran arbeiten wir, Kasum?", the project/refine headings read
// fine as-is and stay untouched.
export function resolveEmptyState(
  variant: Variant,
  hasResults: boolean,
  name?: string | null
): ResolvedEmptyState {
  const empty =
    variant === "refine" ? (hasResults ? VARIANTS.refine : PROJECT_FRESH) : VARIANTS[variant];
  const placeholder =
    variant === "refine" && hasResults
      ? "Sag mir, was ich ändern soll…"
      : "Beschreib, woran wir arbeiten…";
  const heading =
    variant !== "refine" ? `${empty.heading}${name ? `, ${name}` : ""}?` : empty.heading;

  return { heading, placeholder };
}
