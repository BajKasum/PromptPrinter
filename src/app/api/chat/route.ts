import { chatRequestSchema, type ChatMessage } from "@/lib/schemas";
import {
  MAX_ASSISTANT_MESSAGE_CHARS,
  MAX_TRANSCRIPT_MESSAGES,
  MAX_USER_MESSAGE_CHARS,
  truncate,
} from "@/lib/chat-limits";
import {
  rateLimit,
  rateLimitKey,
  reserveMonthlyQuota,
  reserveServerKeyCall,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { chatCompleteStream, llmConfig, classifyLlmFailure, LlmEmptyReplyError } from "@/lib/llm";
import { getUserOverride } from "@/lib/byok";
import { effectiveLimits, type PlanKey } from "@/lib/plans";
import { problem } from "@/lib/api-problem";
import {
  MAX_CHAT_BODY_BYTES,
  RequestBodyTooLargeError,
  readJsonBody,
} from "@/lib/request-body";
import { captureError, logEvent } from "@/lib/observability";
import { CHAT_SYSTEM_PROMPT } from "@/prompts";
import { buildProjectContext } from "@/lib/project-context";
import { persistTurn } from "@/lib/chat-persistence";
import { stubReply } from "@/lib/chat-stub";
import { createSseWriter } from "@/lib/sse-writer";

export const runtime = "nodejs";
export const maxDuration = 300;

// The client replays the whole running transcript every turn (the route
// itself is stateless), uncapped, that cost grows with every reply a
// conversation gets, up to the schema's own 50-message ceiling. Only the most
// recent turns matter for continuity, especially in the refine loop, where
// each reply already IS the current, finished version, so older turns are
// largely superseded rather than needed as history. This only trims what goes
// to the model; persistTurn (below) always stores the full turn regardless.
const CHAT_HISTORY_LIMIT = 12;

function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.length > CHAT_HISTORY_LIMIT ? messages.slice(-CHAT_HISTORY_LIMIT) : messages;
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
function collapseConsecutiveRoles(messages: ChatMessage[]): ChatMessage[] {
  return messages.reduce<ChatMessage[]>((acc, message) => {
    const previous = acc[acc.length - 1];
    if (previous && previous.role === message.role) {
      acc[acc.length - 1] = { ...previous, content: `${previous.content}\n\n${message.content}` };
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
function normalizeTranscript(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const withMessages = body as { messages?: unknown };
  if (
    !Array.isArray(withMessages.messages) ||
    withMessages.messages.length <= MAX_TRANSCRIPT_MESSAGES
  ) {
    return body;
  }
  // Newest entries win: the tail carries the current turn plus the context that
  // still matters, and persistTurn only ever reads the last entry anyway.
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
function clampStoredReplies(body: unknown): unknown {
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

// A German, actionable detail for the validation failures a real client can
// actually produce. Everything else stays generic. The rest of QA finding
// U-4 (raw provider error text reaching the client) is handled by
// describeLlmFailure below.
function describeValidationFailure(
  issues: { code: string; path: (string | number)[] }[]
): string {
  const overlongMessage = issues.some(
    (issue) =>
      issue.code === "too_big" && issue.path[0] === "messages" && issue.path.at(-1) === "content"
  );
  if (overlongMessage) {
    return `Deine Nachricht ist zu lang, höchstens ${MAX_USER_MESSAGE_CHARS.toLocaleString("de-CH")} Zeichen pro Nachricht.`;
  }
  return "Die Anfrage konnte nicht verarbeitet werden. Lade die Seite neu und versuch es erneut.";
}

// German, non-leaking text for a failed model call (QA finding U-4). The
// route used to embed err.message verbatim into the client-visible detail —
// raw provider text like "Z.ai 429: Rate limit exceeded for model
// glm-4.5-air", English mid a German product and a small disclosure of which
// model/provider runs underneath. classifyLlmFailure buckets the error;
// captureError (at the call site) still gets the original for the logs.
function describeLlmFailure(kind: ReturnType<typeof classifyLlmFailure>): string {
  switch (kind) {
    case "rate_limited":
      return "Der KI-Anbieter ist gerade überlastet. Versuch es in einer Minute nochmal.";
    case "auth":
      return "Der KI-Anbieter hat die Anfrage abgelehnt. Das liegt nicht an dir, bitte versuch es später erneut.";
    case "unavailable":
      return "Der KI-Anbieter ist gerade nicht erreichbar. Versuch es in ein paar Minuten nochmal.";
    case "empty":
      return "Der KI-Anbieter hat keine Antwort geliefert. Versuch es nochmal, ggf. mit einer anderen Formulierung.";
    default:
      return "Etwas ist schiefgelaufen. Versuch es nochmal, oder lade die Seite neu.";
  }
}

export async function POST(req: Request) {
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
    return problem(503, "Der Chat ist gerade nicht erreichbar, bitte versuch es später erneut.");
  }

  let sessionUserId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    sessionUserId = data.user?.id ?? null;
  } catch {
    // Auth lookup failed — treat as "not signed in", never as "anonymous, go ahead".
  }
  if (!sessionUserId) {
    return problem(401, "Bitte melde dich an, um mit Finn zu chatten.");
  }
  // Re-bound as a const so the narrowing survives into the stream closure below
  // (TypeScript widens a `let` back to `string | null` inside a callback, since
  // it can't prove nothing reassigns it in between).
  const userId = sessionUserId;

  // 2. Read + validate the transcript the client replays each turn, bounded.
  let body: unknown;
  try {
    body = await readJsonBody(req, MAX_CHAT_BODY_BYTES);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) {
      return problem(413, "Die Anfrage ist zu gross. Starte einen neuen Chat.");
    }
    return problem(400, "Die Anfrage konnte nicht gelesen werden. Lade die Seite neu.");
  }

  const parsed = chatRequestSchema.safeParse(clampStoredReplies(normalizeTranscript(body)));
  if (!parsed.success) {
    return problem(400, describeValidationFailure(parsed.error.issues), {
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const input = parsed.data;

  // The schema allows either role in any position (it validates each message
  // shape independently), but persistTurn (chat-persistence.ts) treats the
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
      "Die Anfrage konnte nicht verarbeitet werden. Lade die Seite neu und versuch es erneut."
    );
  }

  // 3. Enforce the monthly chat allowance, unless the caller configured their
  //    own BYOK key. Checked before the model call, same principle as
  //    /api/projects's own project-count cap. Runs before the rate limit so its
  //    isAdmin result can exempt the account from that too, admin used to only
  //    bypass the monthly cap, not the hourly one. No longer conditional on
  //    there being a user: there always is one now (step 2), which is precisely
  //    what an anonymous request used to skip.
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();
  const [{ data: profile }, { count: chatCount }, override] = await Promise.all([
    supabase.from("profiles").select("plan, is_admin").eq("id", userId).maybeSingle(),
    // One row per turn, persistTurn always inserts exactly one assistant
    // reply alongside the user message, so counting only that role avoids
    // double-counting a turn as two units. Still the number shown in
    // settings/billing either way; also the enforcement fallback below
    // when Redis isn't configured.
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "assistant")
      .gte("created_at", monthStart),
    getUserOverride(userId),
  ]);
  const isAdmin = profile?.is_admin ?? false;
  const rawPlan = (profile?.plan as string | undefined) ?? "free";
  const plan: PlanKey = rawPlan === "pro" || rawPlan === "team" ? rawPlan : "free";
  const limits = effectiveLimits(plan, isAdmin);

  // Slots reserved for this request (monthly allowance, global daily budget),
  // handed back below if the LLM call itself fails so a failed turn doesn't
  // burn anyone's allowance. Collected together because there are two of them
  // now and both have to be released on every failure path.
  const reservations: (() => Promise<void>)[] = [];
  const releaseReservations = async () => {
    for (const release of reservations) await release();
    reservations.length = 0;
  };

  if (!override) {
    // Free's allowance is exactly zero by design (plans.ts): the plan has no
    // access to the server's own key at all, BYOK is required to chat on Free.
    // This is a distinct state from "limit reached" (which implies the account
    // HAD an allowance and used it up) and gets its own message rather than
    // routing through reserveMonthlyQuota — there is nothing to reserve
    // against, and no reason to spend a Redis round trip finding that out on
    // every single attempt.
    if (limits.chatMessages <= 0) {
      return problem(
        403,
        "Free läuft nur mit deinem eigenen KI-Key. Hinterleg einen Anthropic-, OpenAI- oder Gemini-Key in den Einstellungen, oder wechsle zu Pro.",
        { kind: "byokRequired", plan }
      );
    }

    const reservation = await reserveMonthlyQuota(
      `chat-quota:${userId}:${monthKey}`,
      limits.chatMessages
    );
    const overLimit = reservation ? !reservation.allowed : (chatCount ?? 0) >= limits.chatMessages;
    if (overLimit) {
      if (reservation) await reservation.release();
      return problem(
        403,
        `Monatslimit für Chat-Nachrichten erreicht, dein Plan (${plan}) erlaubt ${limits.chatMessages} pro Monat. Nächsten Monat geht's weiter, oder hinterlege einen eigenen API-Key in den Einstellungen.`,
        { kind: "chatMessages", limit: limits.chatMessages, current: chatCount ?? 0, plan }
      );
    }
    if (reservation) reservations.push(reservation.release);
  }

  // 4. Hourly rate limit, skipped for admins. Chat is chattier than a one-shot
  //    call, so the ceiling is generous. There is no separate anonymous tier any
  //    more (it was 20/hr) — anonymous callers never get this far.
  if (!isAdmin) {
    const rl = await rateLimit(rateLimitKey(req, userId), { limit: 120, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) {
      await releaseReservations();
      return problem(429, "Zu viele Anfragen, bitte warte kurz und versuch es erneut.", {
        retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
      });
    }
  }

  // 4b. Global daily ceiling on the server's own provider key (QA finding S-1,
  //     step 4). Every control above it assumes the attacker is a user and
  //     bounds them individually; this one bounds the *bill*, whoever runs it
  //     up and through whichever hole. It is the backstop for the next leak
  //     nobody has found yet — the anonymous-chat hole would have been capped
  //     at one day's budget instead of unbounded had this existed.
  //
  //     Only for calls that actually spend the server's key: a BYOK user runs
  //     on their own account, costs the operator nothing, and keeps working
  //     even while this is tripped. Last check before the model call, so a
  //     request rejected earlier never consumes budget.
  if (!override) {
    const budget = await reserveServerKeyCall();
    if (budget && !budget.allowed) {
      await budget.release();
      await releaseReservations();
      return problem(
        503,
        "Der Chat ist gerade vorübergehend nicht verfügbar. Versuch es später noch einmal, oder hinterlege einen eigenen API-Key in den Einstellungen, dann läuft er sofort weiter."
      );
    }
    if (budget) reservations.push(budget.release);
  }

  // 4c. Refuse in production rather than silently answering with the stub
  //     template (QA finding C-8). Stub mode is a deliberate feature for
  //     development and tests — the whole flow stays testable without any
  //     provider key — but if it were ever reached in production (a missing
  //     ZAI_API_KEY/GEMINI_API_KEY, only warned about at boot, see
  //     assertEnv() in lib/env.ts) it would be a silent total outage of the
  //     one thing this product does: every user gets a plausible-looking
  //     placeholder instead of a real answer, with nothing anywhere signaling
  //     that anything is wrong. A BYOK override always bypasses this, it
  //     never touches the server's own configuration.
  if (!llmConfig() && !override && process.env.NODE_ENV === "production") {
    await releaseReservations();
    return problem(
      503,
      "Der Chat ist gerade nicht richtig eingerichtet. Das liegt nicht an dir, bitte versuch es später erneut."
    );
  }

  // 5. Build the system instruction. One system prompt for every chat now
  //    (CHAT_SYSTEM_PROMPT already asks about the target tool itself when it
  //    isn't known); the request/stored conversation no longer carries a
  //    `mode` at all (QA finding C-2 dropped the last-legacy field + column,
  //    migration 0024). When the chat refines a project, append a compact
  //    context block so the assistant knows what the project already carries.
  let systemInstruction = CHAT_SYSTEM_PROMPT;
  if (input.target) {
    systemInstruction += `\n\nThe user will paste the resulting prompt into: ${input.target}. Tailor wording to that assistant where it helps.`;
  }
  // Ownership-verified project id, never the raw input.projectId (QA finding
  // F-8). The request only checked the value was a UUID, not that this caller
  // owns it, and persistTurn wrote it straight into conversations.project_id
  // regardless — a chat could end up filed under a project its owner can't
  // see (the workspace route 404s them out) and not in the global chat list
  // either (that filters project_id IS NULL), invisibly orphaned. No data
  // leaked (buildProjectContext's own read is RLS-scoped and already
  // returned null for a foreign project), but a real integrity bug: deleting
  // that foreign project would cascade-delete a chat that isn't even yours.
  //
  // buildProjectContext already runs exactly this ownership read as part of
  // building the context block — its null return IS "not found or not
  // owned" (every other exit path returns a non-empty string, starting with
  // the project's own name) — so this reuses that result instead of a second
  // query, per query cost, per turn.
  let verifiedProjectId: string | null = null;
  if (input.projectId) {
    const ctx = await buildProjectContext(supabase, userId, input.projectId);
    if (ctx) {
      systemInstruction += `\n\n${ctx}`;
      verifiedProjectId = input.projectId;
    }
  }

  // 6+7. Produce the reply and persist it, streamed to the client as it's
  //    generated instead of one opaque round trip: everything above this
  //    point (validation, quota, rate limit, system prompt) still returns a
  //    plain JSON problem response on failure, only the actual reply becomes
  //    an SSE stream. Wire protocol (hand-rolled, not the provider's own SSE
  //    dialect, see readOpenAiCompatibleSse in lib/llm.ts for that one):
  //      event: delta  data: {"text": "..."}   zero or more, as text arrives
  //      event: done   data: {conversationId?, persistError?}   exactly one, on success
  //        persistError is a stable CODE ("persist_failed"), never a message —
  //        see the catch below (Security-Audit finding M-1).
  //      event: error  data: {"detail": "..."}                  exactly one, on failure
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const { send, closeQuietly } = createSseWriter(controller);

      // Cost/latency telemetry (QA finding C-7). Character counts stand in for
      // tokens: the streaming path never sees the provider's own usage numbers
      // (they arrive in a final chunk the shared SSE reader doesn't surface),
      // and ~4 chars per token is close enough to spot a trend or a spike.
      // Never the text itself, see observability.ts.
      const startedAt = Date.now();
      const promptChars =
        systemInstruction.length +
        trimHistory(input.messages).reduce((sum, m) => sum + m.content.length, 0);

      let reply = "";
      let mode: "stub" | "generated";
      try {
        if (!llmConfig() && !override) {
          const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
          reply = stubReply(lastUser?.content ?? "");
          mode = "stub";
          send("delta", { text: reply });
        } else {
          mode = "generated";
          for await (const chunk of chatCompleteStream({
            system: systemInstruction,
            messages: collapseConsecutiveRoles(trimHistory(input.messages)),
            override: override ?? undefined,
            signal: req.signal,
          })) {
            reply += chunk;
            send("delta", { text: chunk });
          }
          // Same "empty" bucket as llm.ts's own non-streaming check (this
          // stream-consuming loop can't rely on that one, see chatCompleteStream's
          // own docs), so describeLlmFailure below treats both identically.
          if (!reply.trim()) {
            throw new LlmEmptyReplyError(override?.provider ?? llmConfig()?.provider ?? "provider");
          }
        }
      } catch (err) {
        if (req.signal.aborted) {
          // The client stopped generation itself (not a provider failure):
          // the connection is already gone, so there's no "done"/"error"
          // event left to deliver either way. Best-effort save whatever
          // partial reply had already streamed, same as a natural
          // completion would, so stopping early doesn't silently lose it on
          // the next reload (the client keeps its own local copy of the
          // same partial text). An empty partial means nothing was actually
          // generated yet, nothing to persist, and the reservation is
          // released the same as any other no-op call.
          if (reply.trim()) {
            await persistTurn(supabase, userId, input, reply, verifiedProjectId).catch(() => {});
          } else if (!reply.trim()) {
            await releaseReservations();
          }
          return;
        }
        // The call never produced a (full) reply, so it never actually cost
        // anything, release the reservation instead of burning a slot on
        // nothing. The status line is already committed at this point (200),
        // so a failure mid-stream can only be conveyed as an "error" event,
        // not a 502, the client treats the two the same way either way.
        await releaseReservations();
        captureError("chat.turn_failed", err, {
          userId,
          byok: Boolean(override),
          provider: override?.provider ?? llmConfig()?.provider,
          latencyMs: Date.now() - startedAt,
          promptChars,
          partialReplyChars: reply.length,
        });
        send("error", { detail: describeLlmFailure(classifyLlmFailure(err)) });
        closeQuietly();
        return;
      }

      // Persist the turn (in both modes), so the chat shows up in the sidebar
      // and can be reopened/continued. Persistence failures are surfaced but
      // never block the reply the user is waiting on.
      let conversationId: string | null = input.conversationId ?? null;
      // A stable CODE, never the underlying message (Security-Audit finding
      // M-1). This used to carry err.message straight to the browser, i.e.
      // PostgREST/Postgres text naming constraints, columns and policies —
      // free schema disclosure. The client only ever tested this for
      // truthiness to show its own fixed German warning (chat.tsx), so the
      // text was never read by anyone but an attacker. captureError below
      // still gets the original for the logs.
      let persistError: string | null = null;
      try {
        conversationId = await persistTurn(supabase, userId, input, reply, verifiedProjectId);
      } catch (err) {
        persistError = "persist_failed";
        conversationId = null;
        captureError("chat.persist_failed", err, { userId, projectId: verifiedProjectId });
      }

      logEvent("chat.turn", {
        userId,
        mode,
        byok: Boolean(override),
        provider: override?.provider ?? llmConfig()?.provider,
        inProject: Boolean(verifiedProjectId),
        turns: input.messages.length,
        promptChars,
        replyChars: reply.length,
        latencyMs: Date.now() - startedAt,
        persisted: !persistError,
      });

      send("done", {
        mode,
        ...(conversationId ? { conversationId } : {}),
        ...(persistError ? { persistError } : {}),
      });
      closeQuietly();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Disabling proxy buffering (nginx et al.) so deltas actually arrive
      // incrementally instead of being held until the stream closes.
      "x-accel-buffering": "no",
    },
  });
}
