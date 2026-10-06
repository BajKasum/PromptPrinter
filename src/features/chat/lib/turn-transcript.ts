import type { ChatMessage } from "@/shared/lib/schemas";
import { MAX_ASSISTANT_MESSAGE_CHARS, MAX_TRANSCRIPT_MESSAGES, truncate } from "@/shared/lib/chat-limits";
import type { LlmMessage } from "@/server/llm";

// Was ein Chat-Zug aus dem Verlauf macht, bevor er irgendwohin geht: begrenzen, abschneiden,
// gleiche Rollen verschmelzen. Reine Funktionen, aus api/chat/route.ts herausgeloest (M7).

// The client replays the whole running transcript every turn (the route
// itself is stateless), uncapped, that cost grows with every reply a
// conversation gets, up to the schema's own 50-message ceiling. Only the most
// recent turns matter for continuity, especially in the refine loop, where
// each reply already IS the current, finished version, so older turns are
// largely superseded rather than needed as history. This only trims what goes
// to the model; die Persistenz (openTurn/completeTurn) speichert unabhaengig
// davon immer den vollen Zug.
export const CHAT_HISTORY_LIMIT = 12;

// K-3 (Audit 06.09.2026): a plain slice(-CHAT_HISTORY_LIMIT) cut the window
// at a FIXED distance from the newest turn, and the newest turn is always
// role "user" (openTurn asserts it). Counting back from there, position
// -CHAT_HISTORY_LIMIT lands on "assistant" whenever CHAT_HISTORY_LIMIT is
// even — which 12 is — for EVERY transcript longer than the limit, not just
// some of them: the parity is fixed by the limit itself, not by how long the
// chat happens to be. Anthropic's Messages API rejects outright any request
// whose first message isn't role "user", so every BYOK-Anthropic chat (Free
// requires BYOK) died for good on its 7th turn — reloading doesn't help,
// since the stored history IS what breaks the next request too.
//
// Z.ai and OpenAI happen to tolerate a leading assistant turn, which is
// exactly why this went unnoticed on the default provider — same shape of
// bug as collapseConsecutiveRoles below (QA finding F-4).
export function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  const trimmed =
    messages.length > CHAT_HISTORY_LIMIT ? messages.slice(-CHAT_HISTORY_LIMIT) : messages;
  const firstUserIndex = trimmed.findIndex((m) => m.role === "user");
  // -1 only if the caller's own "must end in user" contract was somehow
  // violated further up the chain — leave the window untouched rather than
  // slicing to an empty array over it.
  return firstUserIndex > 0 ? trimmed.slice(firstUserIndex) : trimmed;
}

// Merges consecutive same-role turns before the transcript reaches a provider
// (QA finding F-4).
//
// Anthropic's Messages API requires strictly alternating roles and rejects
// anything else outright, so a transcript carrying two user turns in a row
// fails hard for every BYOK-Anthropic user. Z.ai and OpenAI happen to tolerate
// it, which is exactly why it went unnoticed on the default provider. The
// client no longer produces that shape (a failed turn is rolled back rather
// than left in the thread), but "no current client does" is not a guarantee —
// an open tab from before that fix, or stored history from one, still can.
//
// Applied to the model-facing copy only: persistence keeps whatever actually
// happened, this just makes it something every provider accepts.
//
// Laeuft seit den Anhaengen auf den fertigen Modell-Nachrichten (Text samt
// Datei-Bloecken, dazu die Bilder) und fuehrt deren Bilder mit zusammen, sonst
// verschwaenden sie beim Verschmelzen.
export function collapseConsecutiveRoles(messages: LlmMessage[]): LlmMessage[] {
  return messages.reduce<LlmMessage[]>((acc, message) => {
    const previous = acc[acc.length - 1];
    if (previous && previous.role === message.role) {
      const images = [...(previous.images ?? []), ...(message.images ?? [])];
      acc[acc.length - 1] = {
        ...previous,
        content: `${previous.content}\n\n${message.content}`,
        ...(images.length > 0 ? { images } : {}),
      };
      return acc;
    }
    acc.push(message);
    return acc;
  }, []);
}

// Makes any stored transcript replayable, whatever it grew into.
//
// QA finding F-1: the transcript cap used to be enforced by the schema alone,
// which turned it into a permanent wall rather than a limit. The client replays
// the whole running transcript each turn and loads it back in full on every
// page view, so once a chat passed the cap, every further turn failed
// validation with a 400 — forever, and with no way out in the UI, because the
// history that broke it is exactly what's persisted. trimHistory (above) did
// not help: it runs on the *parsed* request, long after validation rejected it.
//
// Clamping here, before the schema sees the body, turns that dead end into
// "older turns simply aren't replayed". It also covers clients this deploy
// doesn't control: a tab left open from before the fix, or a direct POST.
export function normalizeTranscript(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const withMessages = body as { messages?: unknown };
  if (
    !Array.isArray(withMessages.messages) ||
    withMessages.messages.length <= MAX_TRANSCRIPT_MESSAGES
  ) {
    return body;
  }
  // Newest entries win: the tail carries the current turn plus the context that
  // still matters, and openTurn only ever reads the last entry anyway.
  return { ...withMessages, messages: withMessages.messages.slice(-MAX_TRANSCRIPT_MESSAGES) };
}

// Same idea as normalizeTranscript, for message *length* (QA finding F-2):
// an assistant reply stored before this fix — or produced by a BYOK custom
// endpoint that ignores the max_tokens we send — can exceed what the schema
// accepts, and replaying it would fail validation forever. Clamping it here
// makes any historically stored reply replayable.
//
// Deliberately only assistant messages: user content has always been bounded by
// the same ceiling it is validated against, so nothing stored can exceed it,
// and silently truncating what somebody just typed would be worse than telling
// them (the composer caps the input, and an over-long direct POST gets a clear
// 400 — see describeValidationFailure).
export function clampStoredReplies(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const withMessages = body as { messages?: unknown };
  if (!Array.isArray(withMessages.messages)) return body;

  let changed = false;
  const messages = withMessages.messages.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const message = entry as { role?: unknown; content?: unknown };
    if (
      message.role !== "assistant" ||
      typeof message.content !== "string" ||
      message.content.length <= MAX_ASSISTANT_MESSAGE_CHARS
    ) {
      return entry;
    }
    changed = true;
    return { ...message, content: truncate(message.content, MAX_ASSISTANT_MESSAGE_CHARS) };
  });

  return changed ? { ...withMessages, messages } : body;
}
