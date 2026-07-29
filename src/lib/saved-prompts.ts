// Helpers for the "Prompt speichern" flow (Ergebnisse-Neubau, 2026-07): pull
// the paste-ready prompt out of an assistant reply and give it a short title.
// A saved prompt is stored as a `generations` row with outputs = { prompt,
// title, target } (see save-prompt-button.tsx + results/page.tsx); the table
// keeps its historical name, but semantically a row is now one prompt the user
// chose to keep. These helpers are the pure, UI-agnostic part, unit-tested on
// their own.

export type SavedPrompt = {
  id: string;
  title: string;
  content: string;
  target: string | null;
  createdAt: string;
};

// A fenced code block: ```<optional lang>\n …body… ```, capturing the lang
// tag too (group 1) alongside the body (group 2). The chat system prompt
// asks for exactly one ```text block holding the finished prompt
// (prompts/system.ts) — but that's a request to a language model, not a
// guarantee, and this is the one place that could actually enforce it.
const FENCE = /```([^\n`]*)\n([\s\S]*?)```/g;

/**
 * Extract the paste-ready prompt from an assistant reply.
 *
 * QA finding F-5: this used to join EVERY fenced block in the reply,
 * separated by a blank line. A reply that included a second block for any
 * reason — an example JSON payload, a schema sketch, a shell command,
 * anything a model tends to append alongside its main answer — got that
 * second block silently folded into the saved prompt. The user would only
 * find out once they pasted a "prompt" into Lovable/Cursor and it made no
 * sense, which is exactly the moment this product exists to prevent.
 *
 * Selection instead of concatenation: prefer a block tagged ```text (what the
 * system prompt actually asks for) — the LAST one, if several exist, since a
 * refinement turn's newest fenced block is the current version, not the
 * first. Falls back to the single longest block when nothing is tagged
 * `text`, on the reasoning that incidental blocks (a short JSON example, an
 * inline command) are typically much shorter than the prompt itself.
 *
 * Returns null when the reply carries no fenced block at all (e.g. Finn asked
 * a clarifying question) — the save affordance keys off that null to stay
 * hidden, so there's nothing to save until an actual prompt exists.
 */
export function extractPrompt(markdown: string): string | null {
  const blocks: { lang: string; body: string }[] = [];
  let match: RegExpExecArray | null;
  FENCE.lastIndex = 0;
  while ((match = FENCE.exec(markdown)) !== null) {
    const body = match[2].replace(/\n$/, "").trim();
    if (body.length > 0) blocks.push({ lang: match[1].trim().toLowerCase(), body });
  }
  if (blocks.length === 0) return null;

  const textBlocks = blocks.filter((b) => b.lang === "text");
  const chosen =
    textBlocks.length > 0
      ? textBlocks[textBlocks.length - 1]
      : blocks.reduce((longest, b) => (b.body.length > longest.body.length ? b : longest));

  return chosen.body.length > 0 ? chosen.body : null;
}

/**
 * Pull the saved prompt text out of a batch of `generations` rows (each row's
 * `outputs` is `{ prompt, title, target }`, see save-prompt-button.tsx). Used
 * by the chat pages to know which prompts are already saved for a project, so
 * SavePromptButton can start disabled instead of allowing a duplicate
 * (QA finding F-7).
 */
export function extractSavedPromptContents(
  rows: { outputs: Record<string, unknown> | null }[]
): string[] {
  return rows
    .map((row) => (row.outputs && typeof row.outputs.prompt === "string" ? row.outputs.prompt : null))
    .filter((prompt): prompt is string => prompt !== null);
}

/**
 * Turns raw `generations` rows into the `SavedPrompt` shape the UI reads
 * (`saved-prompt-list.tsx`). Shared by every page that lists saved prompts —
 * originally only results/page.tsx's own inline version; extracted (QA
 * finding N-1) once /prompts (the project-independent library) needed the
 * exact same mapping. Rows with no usable prompt text are dropped rather
 * than shown as an empty card (defensive: outputs is untyped JSONB, a
 * malformed row shouldn't render as broken UI).
 */
export function mapGenerationRowsToSavedPrompts(
  rows: { id: string; created_at: string; outputs: Record<string, unknown> | null }[]
): SavedPrompt[] {
  return rows
    .map((row) => {
      const outputs = (row.outputs ?? {}) as Record<string, unknown>;
      const content = typeof outputs.prompt === "string" ? outputs.prompt : "";
      const title = typeof outputs.title === "string" ? outputs.title : "Gespeicherter Prompt";
      const target = typeof outputs.target === "string" ? outputs.target : null;
      return { id: row.id, title, content, target, createdAt: row.created_at };
    })
    .filter((p) => p.content.trim().length > 0);
}

const TITLE_MAX = 72;

/**
 * A short, human title from the prompt's first meaningful line, stripped of a
 * leading markdown heading marker or list bullet so it reads as prose. Falls
 * back to a generic label when the prompt has no usable first line.
 */
export function derivePromptTitle(content: string): string {
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return "Gespeicherter Prompt";
  const clean = firstLine
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*]\s+/, "")
    .trim();
  if (clean.length === 0) return "Gespeicherter Prompt";
  return clean.length > TITLE_MAX ? `${clean.slice(0, TITLE_MAX - 1).trimEnd()}…` : clean;
}
