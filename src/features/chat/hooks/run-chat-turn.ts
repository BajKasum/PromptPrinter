"use client";

import "client-only";

import type { Dispatch, MutableRefObject } from "react";
import type { useRouter } from "next/navigation";
import { StreamProtocolError, type Msg } from "@/features/chat/lib/chat-wire";
import type { DraftAttachment } from "@/features/chat/lib/prepare-attachment";
import { parseSseEvents } from "@/features/chat/lib/sse-stream";
import { createTurnEventHandler } from "@/features/chat/lib/turn-events";
import {
  buildChatBody,
  classifyTurnError,
  readHttpFailure,
  type TurnOutcome,
} from "@/features/chat/lib/turn-outcome";
import type { Pending, TurnAction } from "@/features/chat/lib/turn-state";
import { parseChatStreamEvent } from "@/shared/lib/chat-stream";
import type { useT } from "@/shared/i18n/provider";

// Die Anfrage eines Chat-Zugs: senden, den Strom lesen, bei einem Fehler aufräumen. Der Zustand läuft über
// Ereignisse an den Reducer (turn-state.ts), das Bauen der Anfrage und die Einordnung eines Fehlers stehen in
// turn-outcome.ts, die Wirkung der Stromereignisse in turn-events.ts. Hier bleibt der Ablauf.

export type TurnRefs = {
  mounted: MutableRefObject<boolean>;
  pending: MutableRefObject<Pending>;
  pendingAssistantId: MutableRefObject<string | null>;
  abortController: MutableRefObject<AbortController | null>;
};

export type ChatTurnContext = {
  /** Der Stand bei Beginn des Zugs: bei einem Fehler kommt `messages` zurück. */
  snapshot: {
    messages: Msg[];
    conversationId: string | undefined;
    projectId: string | undefined;
    initialConversationId: string | undefined;
  };
  t: ReturnType<typeof useT>;
  router: ReturnType<typeof useRouter>;
  refs: TurnRefs;
  dispatch: Dispatch<TurnAction>;
  commitReply: (text: string, celebrate?: boolean) => void;
  /** Gibt die Dateien eines gescheiterten Zugs in den Composer zurück. */
  restoreAttachments: (uploads: DraftAttachment[]) => void;
};

type TurnAttach = { uploads?: DraftAttachment[]; inheritFrom?: string };

/**
 * Der gemeinsame Kern von Senden, Neu-Erzeugen und Bearbeiten. Gibt den Antworttext zurück, sobald der Strom zu
 * ist, oder null, wenn der Zug ganz gescheitert ist. Der Composer ignoriert ihn, der Sprachmodus braucht ihn:
 * er muss die Antwort vorlesen, die sonst nur in `pending` steht, bis das Schreiben sie nachgeholt hat.
 */
export async function runChatTurn(
  ctx: ChatTurnContext,
  next: Msg[],
  text: string,
  replaceMessageId?: string,
  supersededMessageIds?: string[],
  attach?: TurnAttach
): Promise<string | null> {
  const { snapshot, refs, dispatch, t } = ctx;
  dispatch({ type: "started", next });
  refs.pending.current = null;
  refs.pendingAssistantId.current = null;
  const controller = new AbortController();
  refs.abortController.current = controller;

  const events = createTurnEventHandler({
    dispatch,
    router: ctx.router,
    mounted: refs.mounted,
    pendingAssistantId: refs.pendingAssistantId,
    conversationId: snapshot.conversationId,
    initialConversationId: snapshot.initialConversationId,
    projectId: snapshot.projectId,
    // Die eben optimistisch angehängte Frage, nur für send()/editMessage(). regenerate() hängt nichts an (`next` endet
    // auf einer bestehenden Frage, replaceMessageId ist gesetzt, openTurn schreibt keine neue): an beiden Enden der
    // Leitung derselbe Fall.
    optimisticUserMessageId: replaceMessageId ? null : (next.at(-1)?.id ?? null),
    persistFailedMessage: t.chat.persistFailed,
  });

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        buildChatBody({
          next,
          conversationId: snapshot.conversationId,
          projectId: snapshot.projectId,
          replaceMessageId,
          supersededMessageIds,
          attach,
        })
      ),
      signal: controller.signal,
    });
    if (!res.ok) throw await readHttpFailure(res, t.chat.failed);
    if (!res.body) throw new Error(t.chat.noResponse);

    for await (const raw of parseSseEvents(res.body)) {
      const parsed = parseChatStreamEvent(raw.event, raw.data);
      // Ein Ereignis, das dieser Client nicht kennt (neuere Version des Servers): ignorieren.
      if (parsed.kind === "unknown") continue;
      // Eine kaputte Nutzlast ist ein Fehler im Protokoll, kein Verbindungsabbruch: sie behandelt settleFailedTurn
      // wie einen Fehler der Route und zeigt keine Warnung "Verbindung unterbrochen".
      if (parsed.kind === "invalid") throw new StreamProtocolError(t.chat.streamInvalid);
      events.handle(parsed.value);
    }
    return events.text();
  } catch (error) {
    const accumulated = events.text();
    return settleTurn(ctx, classifyTurnError(error, accumulated, replaceMessageId), {
      error,
      accumulated,
      before: snapshot.messages,
      text,
      uploads: attach?.uploads,
    });
  } finally {
    // Nur die Anfrage ist hier vorbei. Eine fertige Antwort, die noch ausgeschrieben wird, hält `busy` über
    // `pending` weiter, bis sie committet.
    dispatch({ type: "finished" });
  }
}

/** Räumt nach einem Zug auf, der nicht bis `done` kam, und gibt den Text zurück, der als Antwort gilt (oder null). */
function settleTurn(
  ctx: ChatTurnContext,
  outcome: TurnOutcome,
  info: { error: unknown; accumulated: string; before: Msg[]; text: string; uploads?: DraftAttachment[] }
): string | null {
  const { refs, dispatch, commitReply, t } = ctx;
  const { accumulated } = info;
  switch (outcome.kind) {
    case "stoppedBeforeFirstWord":
      // Neu-Erzeugen, gestoppt bevor ein Wort kam (#129): es gibt nichts Neues, die Route behält die alte Antwort.
      // Sie wieder einzusetzen hält Bildschirm und Datenbank gleich, ein Reload zeigt dann dasselbe wie vorher.
      refs.pending.current = null;
      refs.pendingAssistantId.current = null;
      dispatch({ type: "reverted", messages: info.before });
      return accumulated;
    case "stopped":
      // Vom Nutzer gestoppt, kein Fehler: der bisherige Text bleibt als Antwort stehen (die Route sichert denselben
      // Teiltext serverseitig). Keine Feier für eine abgeschnittene Antwort; ein No-op, wenn stop() sie schon committet hat.
      commitReply(accumulated, false);
      return accumulated;
    case "connectionDropped":
      // E-2: die Verbindung riss von selbst, nachdem Text da war. Die Route sichert, was sie erzeugt hat, die
      // Antwort liegt womöglich schon in der Datenbank: den sichtbaren Text wegzuwerfen verlöre, was zu sehen ist,
      // ohne das Gespeicherte zurückzunehmen. Wie bei einem Stopp behalten, aber warnen statt melden: nichts ist beim
      // *Senden* gescheitert, nur "done" kam nicht mehr an.
      commitReply(accumulated, false);
      dispatch({ type: "persistWarned", message: t.chat.connectionDropped });
      return accumulated;
    case "failed":
      refs.pending.current = null;
      // Die Frage kommt aus dem Verlauf zurück in das Eingabefeld, die Dateien mit: sonst blieb sie ohne Antwort
      // im Verlauf und das Feld leer, und der Nutzer verlor seine Eingabe. Zwei Nutzer-Nachrichten in Folge lehnt
      // BYOK-Anthropic ohnehin ab (verlangt wechselnde Rollen), ein Netzwerkfehler ließ so jeden Folgezug scheitern.
      if (info.uploads && info.uploads.length > 0) ctx.restoreAttachments(info.uploads);
      dispatch({
        type: "failed",
        before: info.before,
        input: info.text,
        presentation: presentFailure(outcome, info.error, t),
      });
      return null;
  }
}

function presentFailure(
  outcome: Extract<TurnOutcome, { kind: "failed" }>,
  error: unknown,
  t: ChatTurnContext["t"]
) {
  // Kein Banner und kein "Erneut senden": ein zweiter Versuch scheitert genauso. Der Key-Hinweis nennt die zwei
  // Wege, die gehen. consentRequired: Pro läuft auf Z.ai (Singapur) und braucht vorher die Zustimmung des Kontos
  // (server/consent.ts); der Hinweis nimmt sie entgegen und schickt die wartende Nachricht gleich ab.
  if (outcome.failure === "byokRequired") return { kind: "keyRequired" } as const;
  // Gratis-Rahmen für heute leer: derselbe Key-Weg, dazu der Satz, dass es morgen weitergeht.
  if (outcome.failure === "freeTrialBudget") {
    return { kind: "keyRequired", reason: error instanceof Error ? error.message : undefined } as const;
  }
  if (outcome.failure === "consentRequired") return { kind: "consentRequired" } as const;
  return {
    kind: "error",
    message: error instanceof Error ? error.message : t.common.unknownError,
    retryAfter: outcome.retryAfter,
  } as const;
}
