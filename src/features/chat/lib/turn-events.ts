import type { Dispatch } from "react";
import { StreamProtocolError } from "@/features/chat/lib/chat-wire";
import type { TurnAction } from "@/features/chat/lib/turn-state";
import type { ChatStreamEvent } from "@/shared/lib/chat-stream";

// Die Ereignisse des Antwort-Stroms (shared/lib/chat-stream.ts) und was sie im Zustand eines Zugs bewirken, ein
// kleiner Handler je Ereignis. Ohne React-Hooks, damit es in Node läuft (turn-events.test.ts).

type Ref<T> = { current: T };

export type TurnEventDeps = {
  dispatch: Dispatch<TurnAction>;
  /** `router.refresh()` und `router.replace()` des Next-Routers. */
  router: { refresh: () => void; replace: (href: string, options: { scroll: boolean }) => void };
  /** False, sobald der Chat ausgehängt ist: dann darf nichts mehr navigieren. */
  mounted: Ref<boolean>;
  /** Die echte Zeilen-ID der Antwort, sobald `done` sie nennt; commitReply liest sie ab (K-2). */
  pendingAssistantId: Ref<string | null>;
  /** Die Konversation bei Beginn dieses Zugs, `initialConversationId` des Chats und sein Projekt. */
  conversationId: string | undefined;
  initialConversationId: string | undefined;
  projectId: string | undefined;
  /** Die eben optimistisch angehängte Frage (K-2), oder null beim Neu-Erzeugen. */
  optimisticUserMessageId: string | null;
  /** Der Text der Warnung, wenn die Antwort nicht gespeichert werden konnte. */
  persistFailedMessage: string;
};

/**
 * Der Handler eines Zugs. `handle` wendet ein Ereignis an, `text` ist der bisher angekommene Antworttext (auch
 * für den Abbruch-Zweig, der ihn braucht). Eine lokale Zeichenkette statt `pending` zurückzulesen: ein
 * setState wirkt nicht sofort, die Schleife braucht auf jedem Durchgang den genauen Stand.
 */
export function createTurnEventHandler(deps: TurnEventDeps) {
  const { dispatch } = deps;
  let accumulated = "";
  // Eigene Variable statt des conversationId-States als Wache: ein setState wirkt nicht sofort, `done` sähe sonst
  // weiter den alten Wert und löste router.refresh() ein zweites Mal aus.
  let adoptedId: string | null = null;
  // Einmal zu Beginn des Zugs entschieden: conversationId ändert sich innerhalb eines Zugs nur durch adopt selbst,
  // und das fängt Mehrfachaufrufe schon per adoptedId ab.
  const isFirstTurn = !deps.conversationId && !deps.initialConversationId;

  function adopt(id: string) {
    if (adoptedId === id) return;
    adoptedId = id;
    // Die Route nennt die Konversation beim ersten gespeicherten Zug; sie festzuhalten lässt jeden weiteren Zug an
    // denselben gespeicherten Chat anhängen, und Seitenleiste und Projekt-Chatliste nehmen sie auf.
    if (!deps.conversationId) deps.router.refresh();
    dispatch({ type: "conversationAdopted", id });
  }

  // Die Konversation kommt seit C-1 schon VOR dem ersten Wort. Hier wird bewusst NICHT navigiert (K-1):
  // /chats/new und /chats/[id] sind zwei Route-Segmente mit je eigener Server-Component, die Navigation tauschte
  // die laufende Chat-Instanz aus, und deren Aufräumen bräche den Strom ab, bevor ein Wort steht. Erst `done`
  // navigiert, NACHDEM completeTurn die Antwort geschrieben hat: ein Remount verliert dann nichts mehr.
  function onMeta(data: Extract<ChatStreamEvent, { event: "meta" }>["data"]) {
    if (data.conversationId) adopt(data.conversationId);
    // K-2: die Frage gegen ihre echte Zeilen-ID tauschen, lange bevor die Antwort zu strömen beginnt. Sonst bliebe
    // sie bei ihrer erfundenen ID, und ein späteres Bearbeiten hätte das Problem von "Neu erzeugen" vor dem Fix.
    if (data.userMessageId && deps.optimisticUserMessageId) {
      dispatch({ type: "userMessageIdReplaced", from: deps.optimisticUserMessageId, to: data.userMessageId });
    }
  }

  function onDone(data: Extract<ChatStreamEvent, { event: "done" }>["data"]) {
    const { conversationId: newId, assistantMessageId, persistError } = data;
    // K-2: commitReply liest diese ID ab statt eine eigene zu erfinden. Nur gesetzt, wenn die Antwort auch in der
    // Datenbank steht, sonst gäbe es eine ID, die dropReplacedReply nie fände.
    if (assistantMessageId && !persistError) deps.pendingAssistantId.current = assistantMessageId;
    // Es kommt kein Text mehr; das Schreiben holt auf und committet die Nachricht aus seinem eigenen Rückruf.
    dispatch({ type: "completed", text: accumulated });
    // Normalerweise schon durch `meta` erledigt, bleibt als Rückfall für ein verpasstes Ereignis.
    if (newId) adopt(newId);
    if (persistError) {
      // Kein router.replace: completeTurn ist genau hier gescheitert, die Datenbank hat nur die Frage. Ein
      // Remount lüde die Nachrichten ohne Antwort und verlöre sie sofort statt "beim nächsten Neuladen".
      dispatch({ type: "persistWarned", message: deps.persistFailedMessage });
    } else if (isFirstTurn && newId && deps.mounted.current) {
      deps.router.replace(
        deps.projectId ? `/projects/${deps.projectId}/chats/${newId}` : `/chats/${newId}`,
        { scroll: false }
      );
    }
  }

  function handle(event: ChatStreamEvent) {
    switch (event.event) {
      case "meta":
        return onMeta(event.data);
      case "status":
        if (event.data.phase === "retrying") dispatch({ type: "retrying" });
        return;
      case "delta":
        accumulated += event.data.text;
        return dispatch({ type: "delta", text: accumulated });
      case "error":
        throw new StreamProtocolError(event.data.detail);
      case "done":
        return onDone(event.data);
    }
  }

  return { handle, text: () => accumulated };
}
