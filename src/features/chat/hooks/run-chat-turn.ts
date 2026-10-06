"use client";

import "client-only";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { useRouter } from "next/navigation";
import type { useAttachments } from "@/features/chat/hooks/use-attachments";
import type { DraftAttachment } from "@/features/chat/lib/prepare-attachment";
import { StreamProtocolError, toWire, type Msg } from "@/features/chat/lib/chat-wire";
import { parseSseEvents } from "@/features/chat/lib/sse-stream";
import { MAX_TRANSCRIPT_MESSAGES } from "@/shared/lib/chat-limits";
import type { useT } from "@/shared/i18n/provider";

// Die Anfrage eines Chat-Zugs: senden, den Strom lesen, auf Ereignisse reagieren, bei einem Fehler aufräumen.
// Aus use-chat-turn.ts herausgelöst (M7): der Rumpf ist unverändert, seine Abhängigkeiten (Zustand, Setter,
// Refs) kommen über `ctx`, dieselben Werte, die er vorher als Closure sah.

type Pending = { text: string; complete: boolean } | null;

export type ChatTurnContext = {
  messages: Msg[];
  conversationId: string | undefined;
  projectId: string | undefined;
  initialConversationId: string | undefined;
  t: ReturnType<typeof useT>;
  router: ReturnType<typeof useRouter>;
  attachments: ReturnType<typeof useAttachments>;
  mountedRef: MutableRefObject<boolean>;
  pendingRef: MutableRefObject<Pending>;
  pendingAssistantIdRef: MutableRefObject<string | null>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  commitReply: (text: string, celebrate?: boolean) => void;
  setMessages: Dispatch<SetStateAction<Msg[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setRetryAfter: Dispatch<SetStateAction<number | null>>;
  setPersistWarning: Dispatch<SetStateAction<string | null>>;
  setPending: Dispatch<SetStateAction<Pending>>;
  setJustFinished: Dispatch<SetStateAction<boolean>>;
  setRetrying: Dispatch<SetStateAction<boolean>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setConversationId: Dispatch<SetStateAction<string | undefined>>;
  setInput: Dispatch<SetStateAction<string>>;
  setKeyRequired: Dispatch<SetStateAction<boolean>>;
};

/**
 * Der gemeinsame Kern von Senden und Neu-Erzeugen.
 *
 * `text` ist nur fuer den Fehlerfall da (zurueck in die Eingabe), `next` ist
 * der Verlauf, wie er nach dem Zug aussehen soll.
 */
export async function runChatTurn(
  ctx: ChatTurnContext,
  next: Msg[],
  text: string,
  replaceMessageId?: string,
  supersededMessageIds?: string[],
  attach?: { uploads?: DraftAttachment[]; inheritFrom?: string }
): Promise<string | null> {
  const {
    messages,
    conversationId,
    projectId,
    initialConversationId,
    t,
    router,
    attachments,
    mountedRef,
    pendingRef,
    pendingAssistantIdRef,
    abortControllerRef,
    commitReply,
    setMessages,
    setError,
    setRetryAfter,
    setPersistWarning,
    setPending,
    setJustFinished,
    setRetrying,
    setLoading,
    setConversationId,
    setInput,
    setKeyRequired,
  } = ctx;
  // Der Stand VOR dem Zug, fuer den Fehlerfall. Frueher stand dort ein
  // `slice(0, -1)`, das die zuletzt angehaengte Nachricht wegnahm — beim
  // Neu-Erzeugen waere das die Frage des Nutzers gewesen, die gar nicht neu
  // ist. Den vorherigen Stand wiederherzustellen stimmt in beiden Faellen.
  const before = messages;
  setMessages(next);
  setError(null);
  setRetryAfter(null);
  setPersistWarning(null);
  setPending(null);
  pendingRef.current = null;
  pendingAssistantIdRef.current = null;
  setJustFinished(false);
  setRetrying(false);
  setLoading(true);
  const controller = new AbortController();
  abortControllerRef.current = controller;
  // Die eben optimistisch angehaengte Frage, damit `meta` sie unten gegen
  // die echte Zeilen-ID austauschen kann (K-2) — nur fuer send()/
  // editMessage(), die genau diese Nachricht gerade neu erzeugt haben.
  // regenerate() haengt nichts an (`next` endet dann auf einer bereits
  // bestehenden Frage), replaceMessageId ist in dem Fall gesetzt, und
  // openTurn schreibt entsprechend keine neue Frage (userMessageId bleibt
  // dort null) — derselbe Fall also an beiden Enden der Leitung erkannt.
  const optimisticUserMessageId = replaceMessageId ? null : (next.at(-1)?.id ?? null);
  // The route streams the reply as "delta" events (see /api/chat), a local
  // accumulator rather than reading `streamingReply` back: state updates
  // are async, this loop needs the exact running text on every iteration,
  // not whatever last rendered, and the abort branch below needs whatever
  // arrived so far too.
  let accumulated = "";
  let retryAfterSeconds: number | null = null;
  // The route's machine-readable failure kind (api-problem extras), so a
  // 403 byokRequired can get its own way forward instead of a retry button.
  let failureKind: string | null = null;
  // `messages` stays complete for the transcript on screen; only the newest
  // turns go over the wire. The route forwards just the last 12 to the model
  // and clamps anything longer than this itself, so replaying the full
  // history was pure payload — a long chat sent hundreds of KB per turn to
  // have most of it discarded server-side.
  const windowed =
    next.length > MAX_TRANSCRIPT_MESSAGES ? next.slice(-MAX_TRANSCRIPT_MESSAGES) : next;
  const wireMessages = windowed.map((m, i) =>
    toWire(m, i === windowed.length - 1 ? attach?.uploads : undefined)
  );
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId,
        projectId,
        messages: wireMessages,
        // Nur beim Neu-Erzeugen gesetzt (C-2). Die Route liest daran zwei
        // Dinge ab: die Frage nicht ein zweites Mal speichern, und die alte
        // Antwort erst wegnehmen, wenn die neue sicher steht.
        ...(replaceMessageId ? { replaceMessageId } : {}),
        ...(supersededMessageIds?.length ? { supersededMessageIds } : {}),
        ...(attach?.inheritFrom ? { inheritAttachmentsFrom: attach.inheritFrom } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}) as Record<string, unknown>);
      // The route already tells us how long a 429 lasts; showing it beats
      // making the user guess when they may try again.
      retryAfterSeconds = typeof json.retryAfter === "number" ? json.retryAfter : null;
      failureKind = typeof json.kind === "string" ? json.kind : null;
      throw new Error((json.detail as string | undefined) ?? t.chat.failed);
    }
    if (!res.body) throw new Error(t.chat.noResponse);

    // Die Konversation kommt seit Planpunkt C-1 schon VOR dem ersten Token
    // (SSE-Ereignis `meta`), weil die Route sie zusammen mit der Frage
    // anlegt, bevor sie das Modell fragt.
    //
    // Frueher wurde hier sofort auf die kanonische URL navigiert
    // (`router.replace`) — das brach jede erste Antwort in einem neuen Chat
    // (K-1 im Audit vom 06.09.2026): /chats/new und /chats/[id] sind zwei
    // verschiedene Route-Segmente mit je einer eigenen Server-Component,
    // die Navigation tauscht also die gerade laufende <Chat>-Instanz aus,
    // und das Cleanup oben abortet dadurch den Stream, bevor eine einzige
    // Antwort steht. Die neu gemountete Instanz laed initialMessages aus
    // der DB, in der zu diesem Zeitpunkt nur die Frage steht — die Antwort
    // war in Wahrheit laengst fertig und gespeichert, nur unsichtbar bis
    // zum naechsten Reload.
    //
    // Jetzt navigiert nur noch der `done`-Zweig unten, NACHDEM
    // completeTurn (api/chat/route.ts) die Antwort bereits geschrieben hat
    // — ein Remount an dieser Stelle verliert dann nichts mehr, er kappt
    // hoechstens die Schreibmaschinen-Animation der allerersten Antwort.
    // `router.refresh()` bleibt hier: es rendert dieselbe Route neu, ohne
    // die Seite zu wechseln, kann also nicht unmounten.
    //
    // Eigene Variable statt des `conversationId`-States als Wache: ein
    // setState wirkt nicht sofort, `done` saehe sonst weiterhin den alten
    // Wert und wuerde `router.refresh()` ein zweites Mal ausloesen.
    let adoptedId: string | null = null;
    // Einmal zu Beginn dieses Zugs entschieden, nicht bei jedem Ereignis
    // neu gelesen: `conversationId` aendert sich innerhalb eines Zugs nur
    // durch adoptConversation selbst, das faengt Mehrfachaufrufe schon per
    // `adoptedId` ab.
    const isFirstTurn = !conversationId && !initialConversationId;
    const adoptConversation = (newId: string) => {
      if (adoptedId === newId) return;
      adoptedId = newId;
      // The route returns the conversation id on the first persisted turn;
      // hold onto it so every following turn appends to the same stored
      // chat, and so the sidebar recents + project chat lists pick it up.
      if (!conversationId) router.refresh();
      setConversationId(newId);
    };

    for await (const { event, data } of parseSseEvents(res.body)) {
      if (event === "meta") {
        const { conversationId: newId, userMessageId } = JSON.parse(data) as {
          conversationId?: string;
          userMessageId?: string;
        };
        if (newId) adoptConversation(newId);
        // K-2: die eben optimistisch angehaengte Frage gegen ihre echte
        // Zeilen-ID austauschen, sobald sie bekannt ist — lange bevor die
        // Antwort ueberhaupt zu streamen beginnt, also ohne sichtbaren
        // Effekt. Ohne das bliebe die Frage dauerhaft bei ihrer erfundenen
        // ID, und ein spaeteres Bearbeiten dieser Frage haette dasselbe
        // Problem wie "Neu erzeugen" vor diesem Fix.
        if (userMessageId && optimisticUserMessageId) {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === optimisticUserMessageId ? { ...msg, id: userMessageId } : msg
            )
          );
        }
      } else if (event === "status") {
        const { phase } = JSON.parse(data) as { phase?: string };
        if (phase === "retrying") setRetrying(true);
      } else if (event === "delta") {
        const { text: chunk } = JSON.parse(data) as { text: string };
        setRetrying(false);
        accumulated += chunk;
        setPending({ text: accumulated, complete: false });
      } else if (event === "error") {
        const { detail } = JSON.parse(data) as { detail: string };
        throw new StreamProtocolError(detail);
      } else if (event === "done") {
        const {
          conversationId: newId,
          assistantMessageId,
          persistError,
        } = JSON.parse(data) as {
          conversationId?: string;
          assistantMessageId?: string;
          persistError?: string;
        };
        // K-2: commitReply liest diese ID gleich ab, statt eine eigene zu
        // erfinden. Nur gesetzt, wenn die Antwort auch wirklich in der DB
        // steht (kein persistError) — sonst gaebe es eine ID, die commitReply
        // fuer echt haelt, obwohl `dropReplacedReply` sie nie finden wuerde.
        if (assistantMessageId && !persistError) {
          pendingAssistantIdRef.current = assistantMessageId;
        }
        // No text is coming any more; the reveal finishes writing what's
        // left and commits the message from its own callback.
        setPending({ text: accumulated, complete: true });
        // Normalerweise schon durch `meta` erledigt; bleibt als Rueckfall
        // fuer den Fall, dass ein Client dieses Ereignis nicht sieht.
        if (newId) adoptConversation(newId);
        if (persistError) {
          setPersistWarning(t.chat.persistFailed);
          // Kein router.replace hier: completeTurn ist genau in diesem Fall
          // gescheitert, die DB hat also nur die Frage, nicht die Antwort.
          // Ein Remount jetzt wuerde initialMessages ohne die Antwort laden
          // und sie sofort verlieren, statt erst "beim naechsten Neuladen",
          // wie die Warnung eben sagt.
        } else if (isFirstTurn && newId && mountedRef.current) {
          // Jetzt navigieren, nicht frueher (siehe Kommentar an
          // adoptConversation oben): completeTurn hat die Antwort bereits
          // geschrieben, ein Remount auf /chats/[id] verliert sie also
          // nicht mehr.
          router.replace(
            projectId ? `/projects/${projectId}/chats/${newId}` : `/chats/${newId}`,
            { scroll: false }
          );
        }
      }
    }
    return accumulated;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      // User-initiated stop, not a real failure: keep whatever text had
      // already streamed in as the committed reply instead of discarding
      // it (the route does the same server-side, best-effort persisting
      // the same partial text, see /api/chat). No celebration for a reply
      // the user cut short; a no-op if stop() already committed it.
      commitReply(accumulated, false);
      return accumulated;
    } else if (!(e instanceof StreamProtocolError) && accumulated.trim().length > 0) {
      // QA finding E-2: the connection dropped mid-stream on its own (not a
      // user-initiated stop, and not the route reporting a real failure —
      // that's StreamProtocolError, handled below) after real text had
      // already arrived. The route does its own best-effort persist for
      // whatever it managed to generate before the client vanished, so the
      // reply may already be sitting in the DB — throwing the on-screen
      // text away here would lose what's visible without undoing what's
      // stored, leaving the user with neither. Keep it, exactly like a
      // user-initiated stop, and warn instead of erroring: nothing failed
      // to *send*, the connection just didn't survive to see "done".
      commitReply(accumulated, false);
      setPersistWarning(t.chat.connectionDropped);
      return accumulated;
    } else {
      pendingRef.current = null;
      setPending(null);
      // Roll the optimistic message back out of the transcript and put the
      // text back in the composer. It used to stay in the thread with no
      // reply and the composer cleared, which cost the user their input and
      // left two consecutive user turns behind once they typed again — a
      // shape BYOK-Anthropic rejects outright (it requires alternating
      // roles), so one network blip turned into every following turn
      // failing. Nothing unsent stays in the transcript now.
      setMessages(before);
      setInput(text);
      // Die Dateien kommen mit zurück: der Nutzer soll nach einem Fehler
      // nichts neu auswählen müssen, und bei einem abgelehnten Anhang kann er
      // den Übeltäter in der Vorschau selbst entfernen.
      if (attach?.uploads && attach.uploads.length > 0) attachments.restore(attach.uploads);
      if (failureKind === "byokRequired") {
        // No banner, no "Erneut senden": resending can only fail the same
        // way. The key notice below names the two ways that do work.
        setKeyRequired(true);
      } else {
        setError(e instanceof Error ? e.message : t.common.unknownError);
        setRetryAfter(typeof retryAfterSeconds === "number" ? retryAfterSeconds : null);
      }
    }
    return null;
  } finally {
    // Only the request is over here. A completed reply that is still being
    // written out keeps `busy` true through `pending` until it commits.
    setLoading(false);
    setRetrying(false);
  }
}
