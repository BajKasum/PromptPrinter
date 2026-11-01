import type { Msg } from "@/features/chat/lib/chat-wire";

// Der Zustand eines Chat-Zugs als Reducer. Vorher setzte runChatTurn vierzehn State-Setter an 27 Stellen
// direkt; jetzt meldet es Ereignisse ("started", "delta", "failed", ...), und was daraus für die Oberfläche
// folgt, steht hier an einer Stelle und läuft ohne React (turn-state.test.ts).

export type Pending = { text: string; complete: boolean } | null;

export type TurnState = {
  /** Der Verlauf auf dem Bildschirm; nur die neuesten Nachrichten gehen über die Leitung. */
  messages: Msg[];
  input: string;
  conversationId: string | undefined;
  /** Die Anfrage läuft. Ein fertiger Zug, dessen Text noch geschrieben wird, hält `pending`. */
  loading: boolean;
  error: string | null;
  /** Sekunden bis zum nächsten erlaubten Versuch, direkt aus `retryAfter` der Route; sonst null. */
  retryAfter: number | null;
  /**
   * Die Route hat geantwortet, die Antwort aber nicht speichern können (oder die Verbindung riss danach):
   * die Antwort steht da, nach einem Neuladen wäre sie weg. Etwas anderes als `error` (keine Antwort), weil es
   * den Nutzer nicht am Weiterschreiben hindert, nur warnt.
   */
  persistWarning: string | null;
  /**
   * Die Antwort, die gerade per Strom ankommt (roher, gesammelter Text) und ob der Strom zu ist. Sie wird
   * NICHT bei `done` zur Nachricht: ChatStreamingReply schreibt den Text in lesbarem Tempo aus und ruft
   * danach zurück, erst dann wird der Zug eine echte Nachricht.
   */
  pending: Pending;
  /** Der Server meldet etwas Vorübergehendes und ist schon beim nächsten Versuch. Nur vor dem ersten Wort. */
  retrying: boolean;
  /** Von der fertig geschriebenen Antwort bis zum nächsten Zug; steuert die Abschluss-Markierung. */
  justFinished: boolean;
  /** Kommt aus dem Server-Check und wird durch ein 403 byokRequired gesetzt (zum Beispiel Key in einem anderen Tab gelöscht). */
  keyRequired: boolean;
  /** Pro ohne Zustimmung zur Übermittlung an Z.ai: kommt nur aus dem 403 consentRequired. */
  consentRequired: boolean;
};

/** Was nach einem gescheiterten Zug auf dem Bildschirm steht. */
export type FailurePresentation =
  | { kind: "keyRequired" }
  | { kind: "consentRequired" }
  | { kind: "error"; message: string; retryAfter: number | null };

export type TurnAction =
  | { type: "inputChanged"; value: string }
  | { type: "keyNoticeDismissed" }
  | { type: "consentNoticeDismissed" }
  /** Ein Zug beginnt: `next` ist der Verlauf, wie er nach dem Zug aussehen soll. */
  | { type: "started"; next: Msg[] }
  | { type: "conversationAdopted"; id: string }
  /** Die optimistisch angehängte Frage bekommt ihre echte Zeilen-ID (K-2). */
  | { type: "userMessageIdReplaced"; from: string; to: string }
  | { type: "retrying" }
  /** Neuer Text ist da; `text` ist der gesamte bisherige Text. */
  | { type: "delta"; text: string }
  /** Der Strom ist zu, es kommt kein Text mehr: das Schreiben holt auf und committet selbst. */
  | { type: "completed"; text: string }
  | { type: "persistWarned"; message: string }
  | { type: "pendingCleared" }
  | { type: "replyCommitted"; message: Msg; celebrate: boolean }
  /** Gestoppt, bevor ein Wort kam, beim Neu-Erzeugen: die alte Antwort steht wieder da. */
  | { type: "reverted"; messages: Msg[] }
  /** Gescheitert: der Verlauf vor dem Zug kommt zurück, die Eingabe ins Feld, dazu die Meldung. */
  | { type: "failed"; before: Msg[]; input: string; presentation: FailurePresentation }
  /** Die Anfrage ist vorbei, so oder so. */
  | { type: "finished" };

export function initialTurnState(args: {
  messages?: Msg[];
  conversationId?: string;
  needsKey: boolean;
}): TurnState {
  return {
    messages: args.messages ?? [],
    input: "",
    conversationId: args.conversationId,
    loading: false,
    error: null,
    retryAfter: null,
    persistWarning: null,
    pending: null,
    retrying: false,
    // Ein neu geladener Chat feiert nicht: die Markierung gilt einer Antwort, die man eben hat ankommen sehen.
    justFinished: false,
    keyRequired: args.needsKey,
    consentRequired: false,
  };
}

type Reducers = { [A in TurnAction as A["type"]]: (state: TurnState, action: A) => TurnState };

const reducers: Reducers = {
  inputChanged: (s, a) => ({ ...s, input: a.value }),
  keyNoticeDismissed: (s) => ({ ...s, keyRequired: false }),
  consentNoticeDismissed: (s) => ({ ...s, consentRequired: false }),
  started: (s, a) => ({
    ...s,
    messages: a.next,
    error: null,
    retryAfter: null,
    persistWarning: null,
    pending: null,
    justFinished: false,
    retrying: false,
    loading: true,
  }),
  conversationAdopted: (s, a) => ({ ...s, conversationId: a.id }),
  userMessageIdReplaced: (s, a) => ({
    ...s,
    messages: s.messages.map((m) => (m.id === a.from ? { ...m, id: a.to } : m)),
  }),
  retrying: (s) => ({ ...s, retrying: true }),
  delta: (s, a) => ({ ...s, retrying: false, pending: { text: a.text, complete: false } }),
  completed: (s, a) => ({ ...s, pending: { text: a.text, complete: true } }),
  persistWarned: (s, a) => ({ ...s, persistWarning: a.message }),
  pendingCleared: (s) => ({ ...s, pending: null }),
  replyCommitted: (s, a) => ({
    ...s,
    messages: [...s.messages, a.message],
    justFinished: a.celebrate ? true : s.justFinished,
  }),
  reverted: (s, a) => ({ ...s, pending: null, messages: a.messages }),
  failed: (s, a) => ({
    ...s,
    pending: null,
    messages: a.before,
    input: a.input,
    ...failureFlags(a.presentation),
  }),
  finished: (s) => ({ ...s, loading: false, retrying: false }),
};

function failureFlags(p: FailurePresentation): Partial<TurnState> {
  if (p.kind === "keyRequired") return { keyRequired: true };
  if (p.kind === "consentRequired") return { consentRequired: true };
  return { error: p.message, retryAfter: p.retryAfter };
}

export function turnReducer(state: TurnState, action: TurnAction): TurnState {
  return (reducers[action.type] as (s: TurnState, a: TurnAction) => TurnState)(state, action);
}
