export type ChatMode = "general" | "software";

// There is one chat (REDESIGN.md, Phase 2) — no mode choice at the start. The
// `mode` prop survives as an internal value (legacy conversations carry it, and
// the API picks its system prompt from it), but the empty state is identical
// for both stored modes. Only refining a project's packet is its own context.
export type Variant = "general" | "software" | "refine";

type EmptyConfig = { heading: string; sub: string; starters: string[] };

const UNIFIED_EMPTY: EmptyConfig = {
  heading: "Woran arbeiten wir?",
  sub: "Beschreib dein Ziel — ein Text, ein Lernplan, eine ganze Software-Idee. Ich bau dir den fertigen Prompt und verfeinere ihn mit dir.",
  starters: [
    "Schreib mir einen Prompt für ein professionelles Bewerbungsschreiben.",
    "Ich brauche einen Prompt, der mir einen Lernplan für meine Prüfung erstellt.",
    "Ich hab eine App-Idee — bau mir das komplette Prompt-Paket dafür.",
  ],
};

const VARIANTS: Record<Variant, EmptyConfig> = {
  general: UNIFIED_EMPTY,
  // Legacy mode value on old conversations; the chat experience is one.
  software: UNIFIED_EMPTY,
  refine: {
    heading: "Pass deine Prompts an",
    sub: "Sag mir, was ich an deinen Prompts ändern soll. Du bekommst die aktualisierte, fertige Version zurück.",
    // Unused directly — refine's starters depend on the project's own mode
    // (software vs. general), see REFINE_STARTERS below. Kept here only so
    // every Variant has the same shape; resolveEmptyState below never reads it.
    starters: [],
  },
};

// A project chat before any result exists: nothing to refine yet — the chat
// is where the project's first work happens, briefed by the context rail.
const PROJECT_FRESH: EmptyConfig = {
  heading: "Woran arbeiten wir hier?",
  sub: "Dieser Chat kennt dein Projekt — Anweisungen und Struktur aus der Seitenleiste fließen automatisch ein.",
  starters: [
    "Stell mir Fragen, die mein Briefing schärfen.",
    "Bau mir einen ersten Prompt aus meinem Projektkontext.",
    "Hilf mir zu planen, was dieses Projekt braucht.",
  ],
};

// The refine variant collapses mode away (see resolveVariant), but its
// starter suggestions must still match what the project actually is — a
// Prompt-Projekt has no Frontend-/Backend-/Datenbank-Anteil to reference.
const REFINE_STARTERS: Record<ChatMode, string[]> = {
  software: [
    "Mach den Master-Prompt kürzer und prägnanter.",
    "Ergänze den Frontend-Prompt um einen Dark-Mode.",
    "Erkläre das Datenbank-Schema mit mehr Kommentaren.",
  ],
  general: [
    "Mach den Haupt-Prompt kürzer und direkter.",
    "Passe den Ton an — freundlicher und weniger formell.",
    "Ergänze ein konkretes Beispiel für die gewünschte Ausgabe.",
  ],
};

// A project chat is its own context; every standalone chat is the one
// unified chat.
export function resolveVariant(mode: ChatMode, projectId: string | undefined): Variant {
  return projectId ? "refine" : mode;
}

export type ResolvedEmptyState = EmptyConfig & { placeholder: string };

// Inside a project the copy depends on whether results exist: refining a
// saved packet/prompt vs. doing the project's first work. The refine
// starters additionally need the underlying mode, since "refine" alone
// doesn't say whether this is a software packet or a saved prompt.
export function resolveEmptyState(
  variant: Variant,
  mode: ChatMode,
  hasResults: boolean
): ResolvedEmptyState {
  const empty =
    variant === "refine" ? (hasResults ? VARIANTS.refine : PROJECT_FRESH) : VARIANTS[variant];
  const starters =
    variant === "refine"
      ? hasResults
        ? REFINE_STARTERS[mode]
        : PROJECT_FRESH.starters
      : VARIANTS[variant].starters;
  const placeholder =
    variant === "refine" && hasResults
      ? "Sag mir, was ich ändern soll…"
      : "Beschreib, woran wir arbeiten…";

  return { heading: empty.heading, sub: empty.sub, starters, placeholder };
}
