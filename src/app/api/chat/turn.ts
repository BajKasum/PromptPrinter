import { llmConfig, type LlmMessage } from "@/server/llm";
import { problem } from "@/server/http/api-problem";
import { captureError } from "@/shared/lib/observability";
import { CHAT_SYSTEM_PROMPT } from "@/server/system-prompt";
import { buildProjectContext } from "@/features/projects/lib/project-context";
import { openTurn, type OpenedTurn } from "@/features/chat/lib/chat-persistence";
import type { ValidatedAttachment } from "@/features/chat/lib/attachment-store";
import { buildModelHistory } from "@/features/chat/lib/model-history";
import { collapseConsecutiveRoles, trimHistory } from "@/features/chat/lib/turn-transcript";
import type { ChatMessage, ChatRequest } from "@/shared/lib/schemas";
import type { Messages } from "@/shared/i18n/messages/de";
import type { Allowance } from "./allowance";
import type { SupabaseClient } from "./gate";

// Die Schritte 5 bis 6b von POST /api/chat: was das Modell zu sehen bekommt (Systemprompt samt
// Projektkontext), den Zug in der Datenbank OEFFNEN (vor dem Modell), und der Verlauf samt Anhaengen.

/** Schritt 5: der Systemprompt, bei einem Projekt-Chat mit dem Projektkontext. */
export async function buildSystemInstruction(args: {
  supabase: SupabaseClient;
  userId: string;
  input: ChatRequest;
}): Promise<{ systemInstruction: string; verifiedProjectId: string | null }> {
  const { supabase, userId, input } = args;
  // 5. Build the system instruction. One system prompt for every chat now
  //    (CHAT_SYSTEM_PROMPT asks about the target tool itself in conversation;
  //    the picker that used to send it was removed on 23.09.2026, the model
  //    ignored it anyway); the request/stored conversation no longer carries
  //    a `mode` at all (QA finding C-2 dropped the last-legacy field + column,
  //    migration 0024). When the chat refines a project, append a compact
  //    context block so the assistant knows what the project already carries.
  let systemInstruction = CHAT_SYSTEM_PROMPT;
  // Ownership-verified project id, never the raw input.projectId (QA finding
  // F-8). The request only checked the value was a UUID, not that this caller
  // owns it, and openTurn writes it straight into conversations.project_id
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
  return { systemInstruction, verifiedProjectId };
}

/** Schritt 6: den Zug oeffnen. Scheitert das, geht alles Reservierte zurueck. */
export async function openChatTurn(args: {
  supabase: SupabaseClient;
  userId: string;
  input: ChatRequest;
  verifiedProjectId: string | null;
  uploads: ValidatedAttachment[];
  releaseReservations: Allowance["releaseReservations"];
  m: Messages["api"];
}): Promise<OpenedTurn | Response> {
  const { supabase, userId, input, verifiedProjectId, uploads, releaseReservations, m } = args;
  // 6. Den Zug OEFFNEN, bevor das Modell gefragt wird (Planpunkt C-1).
  //
  //    Vorher wurde der ganze Zug erst nach dem vollstaendigen Stream
  //    geschrieben. Wer den Tab schloss, waehrend Finn antwortete, verlor
  //    damit auch die eigene Frage — sie war nie in der Datenbank, und der
  //    Prozess, der sie haette schreiben sollen, war genau der, den das
  //    Schliessen beendet hat.
  //
  //    Bewusst VOR dem ReadableStream und nicht darin: scheitert das
  //    Schreiben, ist noch keine Statuszeile abgeschickt, und der Client
  //    bekommt eine ehrliche JSON-Fehlerantwort statt eines Streams, der
  //    sofort mit einem Fehlerereignis endet.
  let opened: OpenedTurn;
  try {
    opened = await openTurn(supabase, userId, input, verifiedProjectId, uploads);
  } catch (err) {
    await releaseReservations();
    captureError("chat.open_turn_failed", err, { userId, projectId: verifiedProjectId });
    return problem(503, m.chatPersistFailed);
  }
  return opened;
}

/** Schritt 6b: was das Modell sieht, der Verlauf samt den Anhaengen seiner Nachrichten. */
export async function buildModelMessages(args: {
  supabase: SupabaseClient;
  userId: string;
  input: ChatRequest;
  uploads: ValidatedAttachment[];
  opened: OpenedTurn;
  override: Allowance["override"];
}): Promise<{
  inheritFrom: string | undefined;
  modelWindow: ChatMessage[];
  modelMessages: LlmMessage[];
  attachmentStats: { images: number; files: number };
}> {
  const { supabase, userId, input, uploads, opened, override } = args;
  // 6b. Was das Modell sieht: der Verlauf samt den Anhaengen seiner Nachrichten.
  //     Vor dem Stream und nicht darin, weil dabei Bytes aus dem Bucket geholt
  //     werden koennen und ein Fehler hier noch eine ehrliche JSON-Antwort sein
  //     soll, kein abgebrochener Stream. Die Stub-Antwort braucht nichts davon.
  //
  //     `inheritAttachmentsFrom` zaehlt nur, wenn die Anfrage dieselbe Nachricht
  //     auch als ueberholt fuehrt (supersededMessageIds): so ist es genau der
  //     Bearbeiten-Fall (C-2) und keine frei waehlbare Zeile.
  const inheritFrom =
    input.inheritAttachmentsFrom && input.supersededMessageIds?.includes(input.inheritAttachmentsFrom)
      ? input.inheritAttachmentsFrom
      : undefined;
  const modelWindow = trimHistory(input.messages);
  let modelMessages: LlmMessage[] = [];
  let attachmentStats = { images: 0, files: 0 };
  if (llmConfig() || override) {
    try {
      const history = await buildModelHistory({
        supabase,
        userId,
        conversationId: opened.conversationId,
        window: modelWindow,
        newMessageId: opened.userMessageId,
        inheritFrom,
        preloaded: new Map(uploads.map((u) => [u.id, u.bytes])),
      });
      modelMessages = collapseConsecutiveRoles(history.messages);
      attachmentStats = history.stats;
    } catch (err) {
      // Defensiv: buildModelHistory faengt seine eigenen Lesefehler schon ab.
      // Kommt trotzdem etwas durch, antwortet Finn auf den reinen Text, statt
      // dass der Zug nach bereits geoeffneter Frage ausfaellt.
      captureError("chat.model_history_failed", err, { userId });
      modelMessages = collapseConsecutiveRoles(
        modelWindow.map((msg) => ({ role: msg.role, content: msg.content }))
      );
    }
  }
  return { inheritFrom, modelWindow, modelMessages, attachmentStats };
}
