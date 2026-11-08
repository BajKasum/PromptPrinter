import * as z from "@/shared/lib/zod";

// Der Vertrag des Antwort-Stroms von POST /api/chat: die fünf Ereignisse und ihre Nutzlast, an
// einer Stelle. Der Server (api/chat/reply-stream.ts über server/http/sse-writer.ts) sendet nur
// Nutzlasten dieser Form, der Browser (features/chat/hooks) liest sie mit parseChatStreamEvent,
// und der geplante Terminal-Client liest dieselbe Datei. Das Wire-Format ist
// `event: <name>\ndata: <JSON>\n\n`, eigene Rahmung (nicht der SSE-Dialekt des Anbieters, den
// server/llm/http.ts liest).
//
// Reihenfolge eines Zugs:
//   meta    genau eines, zuerst. Die Konversation steht seit C-1 schon vor dem ersten Wort fest.
//           `userMessageId` fehlt beim Neu-Erzeugen, wo keine Frage geschrieben wird. Der Client
//           tauscht damit seine optimistische ID sofort gegen die echte Zeilen-ID (K-2). Er
//           navigiert bewusst NICHT bei diesem Ereignis (K-1): /chats/new und /chats/[id] sind
//           zwei Route-Segmente, eine sofortige Navigation brächte die laufende Chat-Instanz und
//           damit den Strom selbst zum Abbruch.
//   status  null bis mehrere, nur VOR dem ersten delta: ein Versuch scheiterte an etwas
//           Vorübergehendem (503, abgerissene Verbindung, Ratenlimit), der nächste beginnt gleich
//           (llm-retry.ts). Der Client zeigt "dauert etwas länger", sonst ändert sich nichts.
//   delta   null bis mehrere, solange Text ankommt.
//   done    genau eines, bei Erfolg. `assistantMessageId` ist die echte Zeilen-ID der gespeicherten
//           Antwort (K-2) und fehlt bei `persistError`, weil dann nichts gespeichert wurde.
//           `persistError` ist ein stabiler CODE ("persist_failed"), nie eine Meldung (Security-
//           Audit M-1): sie würde sonst Schema-Text der Datenbank an den Browser tragen.
//   error   genau eines, bei einem Fehler, statt done. `detail` ist ein fertiger, nichts
//           verratender Text in der Sprache der App.
//
// Ältere Clients ignorieren Ereignisse, die sie nicht kennen, und unbekannte Felder (zod entfernt
// sie beim Lesen): neue Ereignisse und Felder sind abwärtskompatibel, ein umbenanntes oder
// entferntes Feld ist es nicht.

export const chatStreamSchemas = {
  meta: z.object({
    conversationId: z.string(),
    userMessageId: z.string().optional(),
  }),
  status: z.object({
    /** "retrying" ist die einzige bekannte Phase; eine unbekannte darf einen älteren Client nicht abbrechen. */
    phase: z.string(),
    attempt: z.number(),
    maxAttempts: z.number(),
  }),
  delta: z.object({ text: z.string() }),
  done: z.object({
    mode: z.enum(["stub", "generated"]),
    conversationId: z.string(),
    assistantMessageId: z.string().optional(),
    persistError: z.string().optional(),
    /** Nur im Gratis-Rahmen (server/free-trial.ts): wie viele Gratis-Prompts nach diesem Zug noch bleiben. */
    freePromptsLeft: z.number().int().min(0).optional(),
  }),
  error: z.object({ detail: z.string() }),
};

// Der Leser ist nachsichtiger als der Sender: der Server schickt immer alle Felder von oben, ein
// Leser verlässt sich aber nur auf das, was er braucht (delta.text, error.detail, status.phase). Fehlt
// ihm ein Kontextfeld (die Konversations-ID in done ist nur ein Rückfall für ein verpasstes meta),
// ist das kein Protokollfehler. Falsche TYPEN eines Felds sind es sehr wohl.
const chatStreamReaders = {
  meta: chatStreamSchemas.meta.partial(),
  status: chatStreamSchemas.status.partial().required({ phase: true }),
  delta: chatStreamSchemas.delta,
  done: chatStreamSchemas.done.partial(),
  error: chatStreamSchemas.error,
};

export type ChatStreamEventName = keyof typeof chatStreamSchemas;

/** Die Nutzlast eines Ereignisses, so wie der Server sie sendet (alle Felder von oben). */
export type ChatStreamPayloads = { [E in ChatStreamEventName]: z.infer<(typeof chatStreamSchemas)[E]> };

/** Ein gelesenes Ereignis, unterschieden am Namen. */
export type ChatStreamEvent = {
  [E in ChatStreamEventName]: { event: E; data: z.infer<(typeof chatStreamReaders)[E]> };
}[ChatStreamEventName];

export type ParsedChatStreamEvent =
  | { kind: "event"; value: ChatStreamEvent }
  /** Ein Ereignis, das dieser Client nicht kennt: ignorieren. */
  | { kind: "unknown"; event: string }
  /** Ein bekanntes Ereignis mit kaputter Nutzlast (kein JSON oder falsche Form): ein Protokollfehler. */
  | { kind: "invalid"; event: ChatStreamEventName };

function isKnownEvent(event: string): event is ChatStreamEventName {
  return Object.hasOwn(chatStreamSchemas, event);
}

/** Liest ein Ereignis des Stroms. Wirft nie: Unbekanntes ist `unknown`, Kaputtes `invalid`. */
export function parseChatStreamEvent(event: string, data: string): ParsedChatStreamEvent {
  if (!isKnownEvent(event)) return { kind: "unknown", event };
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return { kind: "invalid", event };
  }
  const parsed = chatStreamReaders[event].safeParse(json);
  if (!parsed.success) return { kind: "invalid", event };
  return { kind: "event", value: { event, data: parsed.data } as ChatStreamEvent };
}
