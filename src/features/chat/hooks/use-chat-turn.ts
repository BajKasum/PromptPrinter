"use client";

import "client-only";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { useAttachments } from "@/features/chat/hooks/use-attachments";
import type { DraftAttachment } from "@/features/chat/lib/prepare-attachment";
import { viewOf, type Msg } from "@/features/chat/lib/chat-wire";
import { runChatTurn } from "@/features/chat/hooks/run-chat-turn";
import { randomId } from "@/shared/lib/utils";
import { useT } from "@/shared/i18n/provider";

// Der Zustandsautomat eines Chat-Zugs: Verlauf, laufende Anfrage, Fehler, Wiederholen, Neu erzeugen,
// Bearbeiten, Abbruch. Aus chat.tsx herausgeloest (M7). <Chat> haelt nur noch die Oberflaeche zusammen.
export function useChatTurn({
  projectId,
  initialMessages,
  initialConversationId,
  needsKey,
  attachments,
  clearAttachNotice,
}: {
  projectId?: string;
  initialMessages?: Msg[];
  initialConversationId?: string;
  needsKey: boolean;
  attachments: ReturnType<typeof useAttachments>;
  clearAttachNotice: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages ?? []);
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Starts from the server's own check and flips on if the route answers
  // 403 byokRequired anyway (e.g. the key was deleted in another tab).
  const [keyRequired, setKeyRequired] = useState(needsKey);
  // Seconds until a rate-limited request may be retried, straight from the
  // route's own `retryAfter`. Null for every other kind of failure.
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  // Set when the route replied but couldn't persist the turn (json.persistError):
  // the message is shown, but nothing was saved, so a reload loses it. Distinct
  // from `error` (which means no reply at all) since this must not block the
  // user from continuing to chat, only warn them the history isn't safe yet.
  const [persistWarning, setPersistWarning] = useState<string | null>(null);
  // The reply currently arriving via SSE (raw accumulated text), plus whether
  // the stream has closed. It is deliberately NOT committed into `messages`
  // the moment "done" lands: ChatStreamingReply writes the text out at a
  // readable pace and calls back when it has caught up, and only then does the
  // turn become a real message. Committing on "done" instead made the tail of
  // a long prompt appear in one block exactly when the user was watching for
  // it to finish.
  const [pending, setPending] = useState<{ text: string; complete: boolean } | null>(null);
  // The server reported a transient failure and is already on its next
  // attempt (SSE `status`, see /api/chat). Only meaningful before the first
  // word: it flips back off on the first delta and when the turn ends.
  const [retrying, setRetrying] = useState(false);
  // Mirrors `pending` for event handlers (stop()) and for the commit guard;
  // synced in an effect rather than assigned during render.
  const pendingRef = useRef<{ text: string; complete: boolean } | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  // True from the moment a reply finished writing until the next turn starts,
  // drives the celebrating end-of-turn marker. Starts false on a reloaded
  // chat: the marker celebrates a reply you just watched arrive, not every
  // page view of an old one.
  const [justFinished, setJustFinished] = useState(false);
  // The in-flight request's controller, so stop() (below) can abort it.
  const abortControllerRef = useRef<AbortController | null>(null);
  // False once this component has unmounted, so a `done` event that (in some
  // unlikely race) still gets processed afterwards can't call `router.replace`
  // on a router instance that no longer belongs to the visible page — see the
  // unmount effect right below for why that's a real risk here, not a
  // theoretical one.
  const mountedRef = useRef(true);

  // Abort the turn when the chat unmounts — navigating to another chat, into
  // a project, or out of the app entirely.
  //
  // stop() was the only thing that ever aborted, i.e. only a deliberate click.
  // Leaving mid-reply left the fetch running: the provider kept generating
  // tokens for a UI that no longer existed, and those tokens are billed. On
  // the server's own key that is spend for output nobody will ever read,
  // which is precisely the thing this product sells the opposite of. The
  // stream loop also kept calling setPending on a dead component, holding its
  // whole closure — transcript, refs, detached DOM — alive until the model
  // finished on its own.
  //
  // The abort lands in send()'s AbortError branch, whose setState calls are
  // no-ops after unmount. The route persists whatever text had streamed so
  // far, so a turn cut short this way still shows up in the reloaded chat.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- gewollt: abgebrochen wird der Controller, der BEIM Verlassen läuft (runChatTurn tauscht ihn je Zug aus), und er ist ein AbortController, nie ein DOM-Knoten. Die Regel sieht die Zuweisung nicht mehr, seit sie in run-chat-turn.ts steht.
      abortControllerRef.current?.abort();
    };
  }, []);

  // Busy covers both halves of a turn: the request itself, and the stretch
  // afterwards where the text is still being written out. The composer stays
  // in "stop" mode for both, so a reply can't be interrupted by a new one
  // halfway through appearing.
  const busy = loading || pending !== null;

  // Die echte Zeilen-ID der gerade beantworteten Anfrage, sobald die Route sie
  // im `done`-Ereignis mitschickt (K-2, Audit 06.09.2026). `commitReply` liest
  // sie hier ab statt eine neue `randomId()` zu erfinden — sonst schickte
  // "Neu erzeugen"/"Bearbeiten" beim naechsten Zug eine ID, die in der
  // Datenbank nie existiert hat, `dropReplacedReply`/`dropSupersededMessages`
  // liefen ins Leere, und die alte Antwort blieb zusaetzlich zur neuen stehen.
  // Bleibt null (also faellt commitReply auf randomId() zurueck), wenn nie ein
  // `done` ankam (Abbruch, abgerissene Verbindung) — dort gibt es ohnehin
  // keine echte ID zu lernen.
  const pendingAssistantIdRef = useRef<string | null>(null);

  // Turn the in-flight reply into a real message. Idempotent via pendingRef:
  // the reveal's own callback and a stop() click can both reach here for the
  // same reply, and the second one must not append it twice. The text comes in
  // as an argument rather than off the ref, since child effects run before the
  // parent's ref-sync effect and the ref can be one commit stale.
  const commitReply = useCallback((text: string, celebrate = true) => {
    if (pendingRef.current === null) return;
    pendingRef.current = null;
    setPending(null);
    if (!text.trim()) return;
    const id = pendingAssistantIdRef.current ?? randomId();
    pendingAssistantIdRef.current = null;
    setMessages((m) => [...m, { id, role: "assistant", content: text }]);
    if (celebrate) setJustFinished(true);
  }, []);

  function stop() {
    abortControllerRef.current?.abort();
    // The request may already be done and only the writing still running (the
    // stop button stays up for that too). Nothing left to abort in that case,
    // so show the rest at once instead. No celebration: the user cut it short.
    const p = pendingRef.current;
    if (p?.complete) commitReply(p.text, false);
  }

  // Resolves with the reply text once the stream closes, or null if the turn
  // failed outright. Typed callers (the composer) ignore it; voice mode needs
  // it, because it has to read the answer aloud and the reply otherwise only
  // exists inside `pending` until the on-screen reveal finishes writing it.
  async function send(textArg?: string): Promise<string | null> {
    const text = (textArg ?? input).trim();
    if (!text || busy) return null;
    // Dateien, die noch verkleinert werden, würden sonst still zurückbleiben:
    // die Nachricht ginge ohne sie raus. Der Senden-Knopf ist in dem Moment aus,
    // das hier fängt Enter ab.
    const useDrafts = textArg === undefined;
    if (useDrafts && attachments.pending > 0) return null;
    // Eine gesprochene Nachricht (textArg) nimmt die Anhänge des Composers nicht
    // mit: er ist in dem Moment nicht zu sehen, es wäre ein Anhang, den der
    // Nutzer nicht sieht.
    const drafts = useDrafts ? attachments.items : [];
    const next: Msg[] = [
      ...messages,
      {
        id: randomId(),
        role: "user",
        content: text,
        ...(drafts.length > 0 ? { attachments: drafts.map(viewOf) } : {}),
      },
    ];
    setInput("");
    clearAttachNotice();
    if (drafts.length > 0) attachments.clear();
    return run(next, text, undefined, undefined, { uploads: drafts });
  }

  /**
   * Dieselbe Antwort noch einmal erzeugen (Planpunkt C-2).
   *
   * Schneidet die letzte Assistenten-Antwort vom Verlauf ab und schickt den
   * Rest erneut — die Frage bleibt also stehen, sie wird nur neu beantwortet.
   * `replaceMessageId` sagt der Route zweierlei: die Frage NICHT ein zweites
   * Mal speichern (sie steht seit C-1 schon in der Datenbank), und die alte
   * Antwort erst wegnehmen, wenn die neue sicher da ist.
   */
  async function regenerate(): Promise<string | null> {
    if (busy) return null;
    const lastAssistant = messages.map((m) => m.role).lastIndexOf("assistant");
    if (lastAssistant === -1) return null;
    const base = messages.slice(0, lastAssistant);
    // Ohne vorangehende Frage gaebe es nichts neu zu erzeugen — und die Route
    // verlangt ohnehin, dass der Verlauf mit einer Nutzer-Nachricht endet.
    if (base.length === 0 || base[base.length - 1].role !== "user") return null;
    return run(base, base[base.length - 1].content, messages[lastAssistant].id);
  }

  /**
   * Eine eigene Frage aendern und ab dort neu beantworten (Planpunkt C-2).
   *
   * Bearbeiten heisst im Chat immer "ab hier neu": alles nach der geaenderten
   * Frage bezog sich auf eine Frage, die es so nicht mehr gibt. Die alten
   * Zeilen gehen deshalb mit — aber erst, wenn der neue Zug steht, damit ein
   * gescheiterter Anbieter-Aufruf keinen Verlauf loescht.
   */
  async function editMessage(id: string, nextText: string): Promise<string | null> {
    const text = nextText.trim();
    if (!text || busy) return null;
    const index = messages.findIndex((m) => m.id === id);
    if (index === -1 || messages[index].role !== "user") return null;
    if (text === messages[index].content) return null;

    const base = messages.slice(0, index);
    // Bearbeitet wird nur der Text, die Dateien bleiben an der Nachricht. Sie
    // werden nicht noch einmal hochgeladen: der Server hängt sie nach dem
    // erfolgreichen Zug an die neue Fassung um (inheritAttachmentsFrom).
    const kept = messages[index].attachments ?? [];
    const edited: Msg = {
      id: randomId(),
      role: "user",
      content: text,
      ...(kept.length > 0 ? { attachments: kept } : {}),
    };
    const superseded = messages.slice(index).map((m) => m.id);
    return run([...base, edited], text, undefined, superseded, {
      inheritFrom: kept.length > 0 ? messages[index].id : undefined,
    });
  }

  // Der gemeinsame Kern von Senden, Neu-Erzeugen und Bearbeiten steht in run-chat-turn.ts. Hier bekommt er
  // genau die Werte dieses Renders mit (dieselben, die die Funktion vorher als Closure sah).
  function run(
    next: Msg[],
    text: string,
    replaceMessageId?: string,
    supersededMessageIds?: string[],
    attach?: { uploads?: DraftAttachment[]; inheritFrom?: string }
  ): Promise<string | null> {
    return runChatTurn(
      {
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
      },
      next,
      text,
      replaceMessageId,
      supersededMessageIds,
      attach
    );
  }

  // The latest assistant reply is the current result, in the refine loop
  // every turn returns the updated, finished version, so "newest assistant
  // message" is always the thing to read. It gets promoted to a first-class
  // result panel; earlier turns stay a light conversation thread above it.
  const lastAssistantIndex = messages.reduce(
    (acc, m, i) => (m.role === "assistant" ? i : acc),
    -1
  );

  return {
    messages,
    input,
    setInput,
    loading,
    busy,
    error,
    retryAfter,
    keyRequired,
    persistWarning,
    pending,
    retrying,
    justFinished,
    lastAssistantIndex,
    send,
    stop,
    regenerate,
    editMessage,
    commitReply,
  };
}
