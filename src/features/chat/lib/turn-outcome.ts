import { StreamProtocolError, toWire, type Msg } from "@/features/chat/lib/chat-wire";
import type { DraftAttachment } from "@/features/chat/lib/prepare-attachment";
import { MAX_TRANSCRIPT_MESSAGES } from "@/shared/lib/chat-limits";

// Was bei einem Chat-Zug vor und nach dem Strom passiert, ohne React: die Anfrage bauen, eine abgelehnte Anfrage
// lesen, einen Fehler einer Klasse zuordnen. runChatTurn setzt daraus den Ablauf zusammen.

/**
 * Der Rumpf von POST /api/chat. `next` bleibt für die Anzeige vollständig; über die Leitung gehen nur die
 * neuesten Nachrichten. Die Route reicht ohnehin nur die letzten 12 an das Modell und kürzt alles Längere selbst,
 * den ganzen Verlauf zu schicken war reine Last: ein langer Chat schickte Hunderte KB je Zug, damit der
 * Server das meiste wegwarf. Nur an der NEUEN Nachricht reisen Dateien mit (toWire).
 */
export function buildChatBody(args: {
  next: Msg[];
  conversationId: string | undefined;
  projectId: string | undefined;
  replaceMessageId?: string;
  supersededMessageIds?: string[];
  attach?: { uploads?: DraftAttachment[]; inheritFrom?: string };
}) {
  const { next, attach } = args;
  const windowed = next.length > MAX_TRANSCRIPT_MESSAGES ? next.slice(-MAX_TRANSCRIPT_MESSAGES) : next;
  return {
    conversationId: args.conversationId,
    projectId: args.projectId,
    messages: windowed.map((m, i) => toWire(m, i === windowed.length - 1 ? attach?.uploads : undefined)),
    // Nur beim Neu-Erzeugen gesetzt (C-2). Die Route liest daran zwei Dinge ab: die Frage nicht ein zweites
    // Mal speichern, und die alte Antwort erst wegnehmen, wenn die neue sicher steht.
    ...(args.replaceMessageId ? { replaceMessageId: args.replaceMessageId } : {}),
    ...(args.supersededMessageIds?.length ? { supersededMessageIds: args.supersededMessageIds } : {}),
    ...(attach?.inheritFrom ? { inheritAttachmentsFrom: attach.inheritFrom } : {}),
  };
}

/** Die Route hat die Anfrage selbst abgelehnt (kein Strom), mit ihrer maschinenlesbaren Art und Wartezeit. */
export class TurnHttpError extends Error {
  constructor(
    message: string,
    /** Sekunden bis zum nächsten erlaubten Versuch (429); zeigt dem Nutzer, wann es wieder geht. */
    readonly retryAfter: number | null,
    /** Die Art des Fehlers (api-problem), damit zum Beispiel ein 403 byokRequired einen eigenen Weg bekommt. */
    readonly kind: string | null
  ) {
    super(message);
  }
}

/** Liest die Ablehnung einer Anfrage (nicht ok) in einen TurnHttpError. */
export async function readHttpFailure(res: Response, fallbackMessage: string): Promise<TurnHttpError> {
  const json = await res.json().catch(() => ({}) as Record<string, unknown>);
  return new TurnHttpError(
    (json.detail as string | undefined) ?? fallbackMessage,
    typeof json.retryAfter === "number" ? json.retryAfter : null,
    typeof json.kind === "string" ? json.kind : null
  );
}

/** Wie ein Zug endete, wenn er nicht bis `done` kam. */
export type TurnOutcome =
  /** Der Nutzer hat gestoppt: der bisherige Text bleibt als Antwort stehen. */
  | { kind: "stopped" }
  /** Neu-Erzeugen, gestoppt bevor ein Wort kam: es gibt nichts Neues, die alte Antwort bleibt. */
  | { kind: "stoppedBeforeFirstWord" }
  /** Die Verbindung riss mitten im Strom, nachdem schon Text da war. */
  | { kind: "connectionDropped" }
  | {
      kind: "failed";
      /** Die Art der Ablehnung der Route; null für alles andere. */
      failure: string | null;
      retryAfter: number | null;
      error: unknown;
    };

/**
 * Ordnet den Fehler eines Zugs ein. Der Nutzerabbruch (AbortError) ist kein Fehler. Danach unterscheidet sich eine
 * Verbindung, die von selbst riss (nachdem Text kam: sie hat nichts verloren, die Route sichert den Teiltext selbst,
 * also wird gewarnt statt gemeldet), von einem Fehler, den die Route selbst meldet (StreamProtocolError) oder der
 * vor dem ersten Wort eintritt.
 */
export function classifyTurnError(
  error: unknown,
  accumulated: string,
  replaceMessageId: string | undefined
): TurnOutcome {
  if (error instanceof DOMException && error.name === "AbortError") {
    return replaceMessageId && !accumulated.trim() ? { kind: "stoppedBeforeFirstWord" } : { kind: "stopped" };
  }
  if (!(error instanceof StreamProtocolError) && accumulated.trim().length > 0) {
    return { kind: "connectionDropped" };
  }
  const http = error instanceof TurnHttpError ? error : null;
  return { kind: "failed", failure: http?.kind ?? null, retryAfter: http?.retryAfter ?? null, error };
}
