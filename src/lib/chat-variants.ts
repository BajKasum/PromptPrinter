export type ChatMode = "general" | "software";

// There is one chat (REDESIGN.md, Phase 2), no mode choice at the start. The
// `mode` prop survives as an internal value (legacy conversations carry it, and
// the API picks its system prompt from it), but the empty state is identical
// for both stored modes. Only refining a project's packet is its own context.
export type Variant = "general" | "software" | "refine";

type EmptyConfig = { heading: string };

// Just Finn's opening line, no subtext or starter suggestions, Finn is the
// whole empty state. No trailing "?" here, resolveEmptyState below adds it
// after an optional ", {name}" so both read as one clean question.
const UNIFIED_EMPTY: EmptyConfig = { heading: "Woran arbeiten wir" };

const VARIANTS: Record<Variant, EmptyConfig> = {
  general: UNIFIED_EMPTY,
  // Legacy mode value on old conversations; the chat experience is one.
  software: UNIFIED_EMPTY,
  refine: { heading: "Pass deine Prompts an" },
};

// A project chat before any result exists: nothing to refine yet, the chat
// is where the project's first work happens, briefed by the context rail.
const PROJECT_FRESH: EmptyConfig = { heading: "Woran arbeiten wir hier?" };

// A project chat is its own context; every standalone chat is the one
// unified chat.
export function resolveVariant(mode: ChatMode, projectId: string | undefined): Variant {
  return projectId ? "refine" : mode;
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
