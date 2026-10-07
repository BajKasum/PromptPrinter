import { chatRequestSchema, type ChatRequest } from "@/shared/lib/schemas";
import { MAX_ATTACHMENT_STORAGE_PER_USER } from "@/shared/lib/chat-limits";
import { formatBytes } from "@/shared/lib/chat-attachments";
import { createClient } from "@/server/supabase/server";
import { problem } from "@/server/http/api-problem";
import {
  MAX_CHAT_BODY_BYTES,
  RequestBodyTooLargeError,
  readJsonBody,
} from "@/server/http/request-body";
import { captureError } from "@/shared/lib/observability";
import {
  AttachmentError,
  attachmentBytesUsed,
  validateUploads,
  type ValidatedAttachment,
} from "@/features/chat/lib/attachment-store";
import { clampStoredReplies, normalizeTranscript } from "@/features/chat/lib/turn-transcript";
import {
  describeAttachmentError,
  describeValidationFailure,
} from "@/features/chat/lib/turn-failures";
import type { Messages } from "@/shared/i18n/messages/de";
import { fmt } from "@/shared/i18n/format";
import { LOCALE_TAGS, type Locale } from "@/shared/i18n/locales";
import { responseIssues } from "@/shared/lib/zod";

// Die Schritte 1 bis 2b von POST /api/chat: Sitzung, Body, Anhaenge. Jeder Schritt gibt ENTWEDER eine
// Response zurueck (die Route antwortet damit sofort, Statuszeile und Text unveraendert gegenueber vor
// dem Schnitt) ODER seinen Wert. Bis hierher ist noch nichts reserviert.

export type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;
type ApiMessages = Messages["api"];

/** Schritt 1: eine Sitzung, bevor der Body angefasst wird. */
export async function authenticate(
  m: ApiMessages
): Promise<{ supabase: SupabaseClient; userId: string } | Response> {
  // 1. Require a session BEFORE touching the body (Security-Audit finding
  //    H-3). Reading and JSON-parsing first meant an unauthenticated caller
  //    could make the server buffer and parse an arbitrarily large payload and
  //    only then receive a 401 — Next's route handlers have no built-in body
  //    limit, and the rate limiter runs later still, so nothing bounded it.
  //
  //    This route also used to allow anonymous callers outright ("allowed but
  //    rate-limited harder"), which made it the only cost-incurring route
  //    without an auth gate — /api/projects, /api/settings/api-key and
  //    /api/account all 401 first. Two things compounded that: the entire
  //    monthly-quota block below hangs off `userId`, so an anonymous request
  //    skipped it and ran straight against the server's own provider key; and
  //    the only remaining ceiling was an hourly limit keyed on a header the
  //    caller controlled (see rateLimitKey, fixed alongside this). No UI ever
  //    reached the anonymous path — <Chat> renders exclusively inside the
  //    auth-gated (app) segment — so it had no legitimate callers at all.
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    // Supabase isn't reachable/configured at all. Signing in is required from
    // here on, so there is nothing this route can still do — say so plainly
    // instead of silently continuing on the server's key.
    return problem(503, m.chatUnavailable);
  }

  let sessionUserId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    sessionUserId = data.user?.id ?? null;
  } catch {
    // Auth lookup failed — treat as "not signed in", never as "anonymous, go ahead".
  }
  if (!sessionUserId) {
    return problem(401, m.signInToChat);
  }
  // Re-bound as a const so the narrowing survives into the stream closure below
  // (TypeScript widens a `let` back to `string | null` inside a callback, since
  // it can't prove nothing reassigns it in between).
  const userId = sessionUserId;
  return { supabase, userId };
}

/** Schritt 2: den Verlauf lesen und pruefen, begrenzt. */
export async function readTranscript(
  req: Request,
  m: ApiMessages,
  locale: Locale
): Promise<ChatRequest | Response> {
  // 2. Read + validate the transcript the client replays each turn, bounded.
  let body: unknown;
  try {
    body = await readJsonBody(req, MAX_CHAT_BODY_BYTES);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) {
      return problem(413, m.tooLargeNewChat);
    }
    return problem(400, m.unreadableReload);
  }

  const parsed = chatRequestSchema.safeParse(clampStoredReplies(normalizeTranscript(body)));
  if (!parsed.success) {
    return problem(400, describeValidationFailure(parsed.error.issues, m, LOCALE_TAGS[locale].intl), {
      issues: responseIssues(parsed.error.issues),
    });
  }
  const input = parsed.data;

  // The schema allows either role in any position (it validates each message
  // shape independently), but openTurn (chat-persistence.ts) treats the
  // LAST entry as inherently "the new user message" — it stores it verbatim
  // as `role: newUser.role`. The client always appends a user message before
  // posting, so this never fires in the real UI, but a crafted direct POST
  // ending in an assistant-role entry would otherwise get persisted as two
  // consecutive assistant rows (Security-Audit finding L-5). Reject here
  // instead, the same principle F-4 already applies elsewhere in this route:
  // a request that doesn't fit the shape a turn requires is refused, never
  // silently stored mislabeled.
  if (input.messages[input.messages.length - 1].role !== "user") {
    return problem(
      400,
      m.unprocessableReload
    );
  }
  return input;
}

/** Schritt 2b: die Anhaenge der neuen Nachricht pruefen, bevor irgendetwas reserviert wird. */
export async function checkAttachments(args: {
  supabase: SupabaseClient;
  userId: string;
  input: ChatRequest;
  m: ApiMessages;
  locale: Locale;
}): Promise<ValidatedAttachment[] | Response> {
  const { supabase, userId, input, m, locale } = args;
  // 2b. Die Anhaenge der neuen Nachricht pruefen, BEVOR irgendetwas reserviert
  //     oder geschrieben wird: ein kaputter Anhang kostet weder Kontingent noch
  //     Ratelimit, und es entsteht keine halbe Frage in der Datenbank.
  //     Beim Neu-Erzeugen gibt es keine neue Nachricht, also auch keine neuen
  //     Anhaenge (die der bestehenden Frage hat openTurn damals abgelegt).
  const newest = input.messages[input.messages.length - 1];
  const rawUploads =
    newest.role === "user" && !input.replaceMessageId ? (newest.attachments ?? []) : [];
  let uploads: ValidatedAttachment[] = [];
  if (rawUploads.length > 0) {
    try {
      uploads = validateUploads(rawUploads);
    } catch (err) {
      if (err instanceof AttachmentError) {
        const tooLarge = err.code === "tooLarge" || err.code === "tooLargeTotal";
        return problem(tooLarge ? 413 : 400, describeAttachmentError(err.code, m), {
          kind: "attachment",
          reason: err.code,
        });
      }
      throw err;
    }

    // Speicherplatz des Kontos. Der Bucket gehoert dem Betreiber, ohne diese
    // Grenze waere er pro Konto unbegrenzt. Wie die Pruefung oben VOR den
    // Reservierungen: eine abgelehnte Nachricht kostet nichts.
    const incoming = uploads.reduce((sum, u) => sum + u.bytes.length, 0);
    try {
      const used = await attachmentBytesUsed(supabase);
      if (used + incoming > MAX_ATTACHMENT_STORAGE_PER_USER) {
        return problem(
          403,
          fmt(m.attachmentStorageFull, {
            limit: formatBytes(MAX_ATTACHMENT_STORAGE_PER_USER, LOCALE_TAGS[locale].intl),
          }),
          { kind: "attachmentStorage", limit: MAX_ATTACHMENT_STORAGE_PER_USER, current: used }
        );
      }
    } catch (err) {
      captureError("chat.attachment_quota_failed", err, { userId });
      return problem(503, m.chatPersistFailed);
    }
  }
  return uploads;
}
