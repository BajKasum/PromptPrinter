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

// A fenced code block: ```<optional lang>\n …body… ```. The chat system prompt
// puts the finished prompt inside such a block (prompts/system.ts).
const FENCE = /```[^\n`]*\n([\s\S]*?)```/g;

/**
 * Extract the paste-ready prompt from an assistant reply: the joined content of
 * every fenced block, trimmed. Returns null when the reply carries none (e.g.
 * Finn asked a clarifying question) — the save affordance keys off that null to
 * stay hidden, so there's nothing to save until an actual prompt exists.
 */
export function extractPrompt(markdown: string): string | null {
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  FENCE.lastIndex = 0;
  while ((match = FENCE.exec(markdown)) !== null) {
    const body = match[1].replace(/\n$/, "").trim();
    if (body.length > 0) blocks.push(body);
  }
  const joined = blocks.join("\n\n").trim();
  return joined.length > 0 ? joined : null;
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
