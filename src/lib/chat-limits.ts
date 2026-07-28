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
