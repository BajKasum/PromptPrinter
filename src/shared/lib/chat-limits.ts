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
 * How many of a user's saved prompts a global chat page loads for the F-7
 * dedup check (QA finding N-1: saving is project-independent now, so a
 * global chat's dedup runs against every saved prompt this user has, not a
 * project-scoped subset — see chats/new/page.tsx and chats/[id]/page.tsx).
 * Same reasoning as MESSAGE_LOAD_LIMIT above: bounds a query that would
 * otherwise scale with the account's entire saved-prompt history.
 */
export const SAVED_PROMPTS_LOAD_LIMIT = 200;

/**
 * How many rows the chat and project *list* pages read at once.
 *
 * Same class of problem MESSAGE_LOAD_LIMIT and SAVED_PROMPTS_LOAD_LIMIT
 * already fixed, in the three places the earlier pass didn't reach: /chats,
 * /projects and a project's own overview all selected every matching row with
 * no cap. /chats is the worst of the three because each row also carries a
 * `messages(count)` aggregate, so the cost grew with total messages, not just
 * with the number of chats.
 *
 * Read with `.range(0, LIST_LOAD_LIMIT)` — one row MORE than this — so the
 * page can tell "exactly at the cap" from "there are more" and say so instead
 * of silently hiding rows. See hasMoreThanLimit() below.
 */
export const LIST_LOAD_LIMIT = 100;

/**
 * Splits an over-fetched list (LIST_LOAD_LIMIT + 1 rows) into the rows to
 * render and whether anything was cut off.
 *
 * Over-fetching by one is what makes the truncation honest without a second
 * `count` round trip: a plain `.limit(n)` returning n rows is indistinguishable
 * from "there are exactly n" and "there are thousands".
 */
export function splitAtLimit<T>(rows: T[], limit: number = LIST_LOAD_LIMIT): {
  items: T[];
  hasMore: boolean;
} {
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

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
