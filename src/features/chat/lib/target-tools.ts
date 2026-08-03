// The build tools a prompt can be tailored for (QA finding F-3).
//
// `target` travelled through the whole stack — Zod schema, route, system
// prompt, the conversations.target column, the chat list, the save button, the
// results view — and had no input control anywhere, so the column was NULL in
// every row and five rendering paths were dead. Meanwhile "Für jede Ziel-KI"
// was advertised as a Free feature. This is the missing half.
//
// Deliberately a short list plus free text rather than an exhaustive registry:
// the point is to name the tool in the prompt, and CHAT_SYSTEM_PROMPT asks for
// it in conversation anyway when it isn't set. A new tool every month must not
// mean a code change to be usable.

/** The tools offered as one-click choices, in rough order of how often they come up. */
export const TARGET_TOOLS = [
  "Lovable",
  "Cursor",
  "Claude Code",
  "v0",
  "Bolt",
  "Replit",
  "Windsurf",
  "ChatGPT",
] as const;

/** Mirrors chatRequestSchema's own ceiling for `target`. */
export const MAX_TARGET_LENGTH = 40;

/**
 * Normalizes a stored or typed target: trimmed, length-capped, and empty
 * collapsed to undefined so "no target" is one value rather than three
 * ("" / null / undefined) spread across the DB, the request and the UI.
 */
export function normalizeTarget(raw: string | null | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > MAX_TARGET_LENGTH ? trimmed.slice(0, MAX_TARGET_LENGTH) : trimmed;
}
