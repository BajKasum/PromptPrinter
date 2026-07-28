// The size limits of one chat turn, in one place because they are enforced in
// three: the composer (client), the Zod schema (request contract) and
// /api/chat's own normalization before validation.
//
// Deliberately zod-free so the client can import it without pulling zod into
// the browser bundle for a couple of numbers — lib/schemas.ts imports these,
// not the other way round.

/**
 * How many transcript entries a single request may carry.
 *
 * The client replays the running transcript on every turn and it grows without
 * bound as a chat is continued, so this used to be a hard wall: past the cap
 * EVERY further turn failed validation, permanently, because the history that
 * broke it is exactly what's stored (QA finding F-1). It is a *clamp* now, not
 * a wall — /api/chat trims a request down to the newest entries before
 * validating (normalizeTranscript), so a long chat degrades to "older turns
 * aren't replayed" instead of "this chat is dead".
 *
 * Sized as headroom over the route's own model-facing window
 * (CHAT_HISTORY_LIMIT = 12): only the newest 12 are ever forwarded to the
 * model, so everything above that is slack for changing that window without
 * touching the client, not context the model actually sees.
 */
export const MAX_TRANSCRIPT_MESSAGES = 24;

/**
 * Longest message a user may send. Enforced in the composer (so it can't
 * normally be hit) and by the schema (so a direct POST can't bypass it).
 */
export const MAX_USER_MESSAGE_CHARS = 8000;

/**
 * Longest assistant reply that may be stored and replayed.
 *
 * This used to share the user ceiling above, and that single shared number was
 * a chat-killer (QA finding F-2): an assistant reply is bounded by the model's
 * own output budget, not by what someone can type. llm.ts's
 * DEFAULT_MAX_OUTPUT_TOKENS of 6144 is worth roughly 20-25k characters, so a
 * genuinely good, complete prompt routinely blew past 8000 — and because the
 * reply is stored and replayed on the next turn, the chat then failed
 * validation forever. The better the answer, the surer the chat died.
 *
 * 40000 sits comfortably above what that token budget can produce while still
 * bounding a BYOK custom endpoint that ignores the max_tokens we send (llm.ts
 * only caps those at MAX_RESPONSE_BYTES, which is about raw memory, not a
 * sensible message length). Raise DEFAULT_MAX_OUTPUT_TOKENS and this has to
 * move with it.
 */
export const MAX_ASSISTANT_MESSAGE_CHARS = 40000;

/**
 * How many stored messages a chat page loads on initial render.
 *
 * Distinct from MAX_TRANSCRIPT_MESSAGES above: that one bounds what a single
 * *request* replays to the model, this one bounds what a *page view* reads
 * from the DB to show the transcript at all. Both queries used to be
 * unbounded — every message a conversation ever had, on every page view, cost
 * that grows with a single chat's lifetime rather than with request size (QA
 * finding P-1). No "load earlier messages" UI exists yet to page past this,
 * so it is a real (if today mostly theoretical) cap on visible scrollback,
 * not just a performance tweak.
 */
export const MESSAGE_LOAD_LIMIT = 300;

/**
 * Caps `s` at `max` characters *including* the ellipsis. The ellipsis used to
 * be appended after slicing to `max`, making the result max + 1 — irrelevant
 * for most callers, but off by exactly the one character that would push a
 * clamped chat reply back over the schema limit it is being clamped to.
 *
 * Shared by project-context.ts (workspace context budgets) and
 * chat-persistence.ts (clamping an over-long stored reply), which is why it
 * lives here rather than in either — a small, dependency-free string helper,
 * not conceptually owned by either the context-builder or the persistence
 * layer (QA finding C-1).
 */
export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
