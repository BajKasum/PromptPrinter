import {
  chatCompleteStream,
  llmConfig,
  classifyLlmFailure,
  LlmEmptyReplyError,
  type LlmMessage,
} from "@/server/llm";
import { attemptsOf } from "@/server/llm-retry";
import { captureError, logEvent } from "@/shared/lib/observability";
import {
  completeTurn,
  dropReplacedReply,
  dropSupersededMessages,
  rollbackTurn,
  type OpenedTurn,
} from "@/features/chat/lib/chat-persistence";
import { stubReply } from "@/features/chat/lib/chat-stub";
import { adoptAttachments, type ValidatedAttachment } from "@/features/chat/lib/attachment-store";
import { describeLlmFailure } from "@/features/chat/lib/turn-failures";
import { createSseWriter } from "@/server/http/sse-writer";
import type { ChatMessage, ChatRequest } from "@/shared/lib/schemas";
import type { Messages } from "@/shared/i18n/messages/de";
import type { Allowance } from "./allowance";
import type { SupabaseClient } from "./gate";

// Schritt 7 von POST /api/chat: die Antwort erzeugen, speichern und als SSE-Strom an den Client geben.
// Alles davor antwortet bei einem Fehler mit einer JSON-Problem-Antwort, erst die Antwort selbst wird
// ein Strom. Hier liegen die Ausstiege NACH dem Start des Stroms: Anbieterfehler, Abbruch durch den
// Nutzer, Speichern der Antwort. Welcher die Reservierungen zurueckgibt und welcher sie behaelt, haelt
// route.exits.test.ts fest.

export function replyStream(args: {
  req: Request;
  supabase: SupabaseClient;
  userId: string;
  m: Messages["api"];
  input: ChatRequest;
  uploads: ValidatedAttachment[];
  opened: OpenedTurn;
  override: Allowance["override"];
  releaseReservations: Allowance["releaseReservations"];
  systemInstruction: string;
  verifiedProjectId: string | null;
  inheritFrom: string | undefined;
  modelWindow: ChatMessage[];
  modelMessages: LlmMessage[];
  attachmentStats: { images: number; files: number };
}): ReadableStream<Uint8Array> {
  const {
    req,
    supabase,
    userId,
    m,
    input,
    uploads,
    opened,
    override,
    releaseReservations,
    systemInstruction,
    verifiedProjectId,
    inheritFrom,
    modelWindow,
    modelMessages,
    attachmentStats,
  } = args;
  // 7. Produce the reply and persist it, streamed to the client as it's
  //    generated instead of one opaque round trip: everything above this
  //    point (validation, quota, rate limit, system prompt) still returns a
  //    plain JSON problem response on failure, only the actual reply becomes
  //    an SSE stream. Wire protocol (hand-rolled, not the provider's own SSE
  //    dialect, see readOpenAiCompatibleSse in lib/llm.ts for that one):
  //      event: meta   data: {conversationId, userMessageId?}  exactly one, first
  //        Seit C-1 steht die Konversation schon vor dem ersten Token fest.
  //        Fruehes Senden erlaubt dem Client, seine mit `randomId()`
  //        optimistisch angelegte Frage sofort gegen die echte Zeilen-ID
  //        auszutauschen (K-2, Audit 06.09.2026) — `userMessageId` fehlt
  //        beim Neu-Erzeugen, wo openTurn keine Frage schreibt.
  //        Der Client navigiert bewusst NICHT mehr bei diesem Ereignis (K-1,
  //        Audit 06.09.2026): /chats/new und /chats/[id] sind zwei
  //        verschiedene Route-Segmente, eine sofortige Navigation wuerde die
  //        laufende Chat-Instanz und damit den Stream selbst abbrechen.
  //      event: status data: {phase: "retrying", attempt, maxAttempts}
  //        zero or more, only BEFORE the first delta: an attempt failed on
  //        something transient (503, dropped connection, rate limit) and the
  //        next one is about to start (llm-retry.ts). The client shows a calm
  //        "this is taking a little longer", nothing else changes. Older
  //        clients ignore events they don't know.
  //      event: delta  data: {"text": "..."}   zero or more, as text arrives
  //      event: done   data: {conversationId?, assistantMessageId?, persistError?}
  //        exactly one, on success. assistantMessageId (K-2) ist die echte
  //        Zeilen-ID der gespeicherten Antwort, fehlt bei persistError, weil
  //        dann nichts gespeichert wurde. persistError ist eine stabile CODE
  //        ("persist_failed"), nie eine Meldung — siehe den catch unten
  //        (Security-Audit finding M-1).
  //      event: error  data: {"detail": "..."}                  exactly one, on failure
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const { send, closeQuietly } = createSseWriter(controller);

      // Zuerst, noch vor dem ersten Token: der Client kennt damit die
      // Konversation, bevor irgendetwas schiefgehen kann.
      send("meta", {
        conversationId: opened.conversationId,
        ...(opened.userMessageId ? { userMessageId: opened.userMessageId } : {}),
      });

      // Cost/latency telemetry (QA finding C-7). Character counts stand in for
      // tokens: the streaming path never sees the provider's own usage numbers
      // (they arrive in a final chunk the shared SSE reader doesn't surface),
      // and ~4 chars per token is close enough to spot a trend or a spike.
      // Never the text itself, see observability.ts.
      const startedAt = Date.now();
      const promptChars =
        systemInstruction.length +
        (modelMessages.length > 0 ? modelMessages : modelWindow).reduce(
          (sum, m) => sum + m.content.length,
          0
        );

      let reply = "";
      let mode: "stub" | "generated";
      // Der Anbieter, auf dem der Zug WIRKLICH lief: bei einem Failover von Z.ai
      // auf Gemini (llm-failover.ts) ist das nicht der, den llmConfig() nennt, und
      // fuer eine Kostenauswertung im Log ist genau das der Unterschied.
      let usedProvider: string | undefined = override?.provider ?? llmConfig()?.provider;
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
            messages: modelMessages,
            override: override ?? undefined,
            signal: req.signal,
            onRetry: ({ failedAttempt, maxAttempts }) =>
              send("status", { phase: "retrying", attempt: failedAttempt + 1, maxAttempts }),
            onProvider: (provider) => {
              usedProvider = provider;
            },
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
          // The client stopped generation itself, or closed the tab (not a
          // provider failure): the connection is already gone, so there's no
          // "done"/"error" event left to deliver either way. Best-effort save
          // whatever partial reply had already streamed, so stopping early
          // doesn't silently lose it on the next reload (the client keeps its
          // own local copy of the same partial text).
          //
          // Seit C-1 ist der wichtige Teil das, was hier NICHT steht: die
          // Frage bleibt in jedem Fall stehen, weil openTurn sie laengst
          // geschrieben hat. Genau das war der Verlust, den dieser Planpunkt
          // behebt — vorher war ohne Teiltext der ganze Zug weg, inklusive
          // der eigenen Nachricht.
          if (reply.trim()) {
            await completeTurn(supabase, userId, opened.conversationId, reply).catch(() => {});
          } else {
            await releaseReservations();
          }
          // Den Stream trotzdem schliessen. Fuer den echten Abbruch ist das
          // folgenlos (es hoert niemand mehr zu, closeQuietly schluckt den
          // Fehler eines bereits geschlossenen Controllers), aber ein
          // ReadableStream, der nie endet, bleibt sonst offen — im Test haengt
          // dadurch jedes Auslesen der Antwort bis zum Timeout.
          closeQuietly();
          return;
        }
        // The call never produced a (full) reply, so it never actually cost
        // anything, release the reservation instead of burning a slot on
        // nothing. The status line is already committed at this point (200),
        // so a failure mid-stream can only be conveyed as an "error" event,
        // not a 502, the client treats the two the same way either way.
        await releaseReservations();
        // Und die Frage wieder wegnehmen: die Oberflaeche rollt sie bei einem
        // Anbieter-Fehler zurueck und stellt die Eingabe wieder her (F-4/U-6).
        // Bliebe die Zeile stehen, staende sie nach einem Reload wieder da und
        // in der Seitenleiste haenge ein Chat, der nur aus ihr besteht. Das
        // gilt ausdruecklich NICHT fuer den Abbruch oben.
        await rollbackTurn(supabase, userId, opened);
        captureError("chat.turn_failed", err, {
          userId,
          byok: Boolean(override),
          provider: usedProvider,
          latencyMs: Date.now() - startedAt,
          promptChars,
          partialReplyChars: reply.length,
          // Wie oft der Anbieter gefragt wurde, bevor aufgegeben wurde. Fehlt
          // bei einem Fehler, der gar nicht erst wiederholt wird (falscher Key).
          attempts: attemptsOf(err),
        });
        send("error", { detail: describeLlmFailure(classifyLlmFailure(err), m) });
        closeQuietly();
        return;
      }

      // Die Antwort an den bereits geoeffneten Zug haengen. Die Konversation
      // und die Frage stehen seit openTurn (C-1), hier fehlt nur noch das
      // Ergebnis. Persistence failures are surfaced but never block the reply
      // the user is waiting on.
      const conversationId: string = opened.conversationId;
      // A stable CODE, never the underlying message (Security-Audit finding
      // M-1). This used to carry err.message straight to the browser, i.e.
      // PostgREST/Postgres text naming constraints, columns and policies —
      // free schema disclosure. The client only ever tested this for
      // truthiness to show its own fixed German warning (chat.tsx), so the
      // text was never read by anyone but an attacker. captureError below
      // still gets the original for the logs.
      let persistError: string | null = null;
      // Die echte Zeilen-ID der gespeicherten Antwort (K-2, Audit
      // 06.09.2026) — geht im `done`-Ereignis an den Client, der damit seine
      // optimistische `randomId()` ersetzt. Bleibt null bei einem
      // persistError, dann gibt es keine Zeile, deren ID man mitschicken
      // koennte.
      let assistantMessageId: string | null = null;
      try {
        assistantMessageId = await completeTurn(supabase, userId, conversationId, reply);
        // Beim Neu-Erzeugen (C-2) faellt die alte Antwort JETZT weg, nicht
        // vorher: waere sie schon beim Start geloescht worden, stuende der
        // Nutzer nach einem gescheiterten Anbieter-Aufruf ohne beides da.
        if (input.replaceMessageId) {
          await dropReplacedReply(supabase, userId, conversationId, input.replaceMessageId);
        }
        // Bearbeitete Frage mit Anhaengen: die Dateien wandern jetzt an die
        // neue Fassung, VOR dem Wegwerfen der alten. Andersherum wuerde die
        // Kaskade sie mit der alten Zeile loeschen, und dropSupersededMessages
        // raeumte auch noch ihre Objekte weg. Scheitert das Umhaengen, bleibt
        // die alte Fassung samt Anhaengen stehen: ein doppelter Eintrag im
        // Verlauf ist harmlos, verlorene Dateien nicht.
        let adopted = true;
        if (inheritFrom && opened.userMessageId) {
          try {
            await adoptAttachments({
              userId,
              conversationId,
              fromMessageId: inheritFrom,
              toMessageId: opened.userMessageId,
            });
          } catch (err) {
            adopted = false;
            captureError("chat.attachments_adopt_failed", err, { userId });
          }
        }
        // Bearbeitete Frage (C-2): die alte Fassung und alles, was ihr folgte,
        // faellt jetzt weg — aus demselben Grund erst hier.
        if (adopted && input.supersededMessageIds?.length) {
          await dropSupersededMessages(
            supabase,
            userId,
            conversationId,
            input.supersededMessageIds
          );
        }
      } catch (err) {
        persistError = "persist_failed";
        captureError("chat.persist_failed", err, { userId, projectId: verifiedProjectId });
      }

      logEvent("chat.turn", {
        userId,
        mode,
        byok: Boolean(override),
        provider: usedProvider,
        inProject: Boolean(verifiedProjectId),
        turns: input.messages.length,
        // Nur Zaehler, nie Namen oder Inhalte (observability.ts).
        attachmentsAdded: uploads.length,
        attachmentImages: attachmentStats.images,
        promptChars,
        replyChars: reply.length,
        latencyMs: Date.now() - startedAt,
        persisted: !persistError,
      });

      send("done", {
        mode,
        conversationId,
        ...(assistantMessageId ? { assistantMessageId } : {}),
        ...(persistError ? { persistError } : {}),
      });
      closeQuietly();
    },
  });
  return stream;
}
