"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { ChatEmptyState } from "@/features/chat/components/chat-empty-state";
import { ChatResultPanel } from "@/features/chat/components/chat-result-panel";
import {
  ChatUserBubble,
  ChatAssistantBubble,
  ChatTyping,
  ChatStreamingReply,
  ChatFinishedMarker,
} from "@/features/chat/components/chat-transcript";
import { ChatComposer } from "@/features/chat/components/chat-composer";
import { VoiceBar } from "@/features/chat/components/voice-bar";
import { resolveVariant, resolveEmptyState } from "@/features/chat/lib/chat-variants";
import { parseSseEvents } from "@/features/chat/lib/sse-stream";
import { MAX_TRANSCRIPT_MESSAGES } from "@/shared/lib/chat-limits";
import { normalizeTarget } from "@/features/chat/lib/target-tools";
import { randomId } from "@/shared/lib/utils";

// A stable id per message (real DB id for history loaded from the server,
// a client-generated one for anything created during this session) is the
// React key below, an always-appending list would tolerate the array index
// too, but a stable id survives if the transcript is ever edited/trimmed.
type Msg = { id: string; role: "user" | "assistant"; content: string };

// Distinguishes an explicit "error" SSE event (the route/provider reporting a
// real, actionable failure — rate-limited, model unavailable) from any other
// exception the catch block sees (a network drop, a rejected body read). Both
// can happen after text already accumulated, but only the former means the
// reply itself is bad; the latter (QA finding E-2) means the connection died
// while a perfectly good reply was in flight, and should be kept, not discarded.
class StreamProtocolError extends Error {}

// "in 2 Minuten" reads better than "in 118 Sekunden"; below a minute the exact
// number is the useful part.
function formatRetryDelay(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))} Sekunden`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "einer Minute" : `${minutes} Minuten`;
}

// Orchestrator only, every UI role that used to live inline here now has its
// own file (chat-empty-state, chat-result-panel, chat-transcript,
// chat-composer, chat-markdown; the variant/empty-state data lives in
// lib/chat-variants.ts). This component owns the actual chat state
// (transcript, in-flight send) and composes the pieces, a UX change to, say,
// the composer no longer risks touching markdown rendering or the
// empty-state copy along the way.
export function Chat({
  target: initialTarget,
  projectId,
  initialMessages,
  initialConversationId,
  hasResults = false,
  savedPrompts,
  name,
}: {
  target?: string;
  projectId?: string;
  initialMessages?: Msg[];
  initialConversationId?: string;
  /** For project chats: whether saved results exist (drives the empty-state copy). */
  hasResults?: boolean;
  /** Prompt text of every result already saved in this project (QA F-7: dedup without a migration). */
  savedPrompts?: string[];
  /** The user's display name, personalizes the unified empty-state greeting. */
  name?: string | null;
}) {
  // A project chat is its own context; every standalone chat is the one
  // unified chat. See lib/chat-variants.ts for what each variant means.
  const variant = resolveVariant(projectId);
  const { heading, placeholder } = resolveEmptyState(variant, hasResults, name);

  const router = useRouter();
  // The tool this prompt is being written for. Was a read-only prop with no
  // control anywhere, so conversations.target was NULL in every row while the
  // pricing page advertised "Für jede Ziel-KI" (QA finding F-3). Seeded from
  // the stored conversation, or from the project's own "Ziel-KI" field for a
  // fresh project chat, so the rail and the chat can't disagree.
  const [target, setTarget] = useState<string | undefined>(normalizeTarget(initialTarget));
  const [messages, setMessages] = useState<Msg[]>(initialMessages ?? []);
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  // Two scroll anchors: the bottom of the thread (used while a turn is in
  // flight, so the user sees their message + the typing indicator clear the
  // sticky composer) and the top of the latest result (used once the reply
  // lands, so a long result opens at its start, you read a prompt top-down).
  const endRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  // Continuous auto-scroll is a concrete accessibility complaint for people
  // with vestibular disorders. Same hook the rest of the app already uses
  // (chat-transcript, sidebar, animated-mascot) rather than a second,
  // hand-rolled matchMedia listener alongside it.
  const reducedMotion = useReducedMotion() ?? false;
  // The in-flight request's controller, so stop() (below) can abort it.
  const abortControllerRef = useRef<AbortController | null>(null);

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
    return () => abortControllerRef.current?.abort();
  }, []);

  // Busy covers both halves of a turn: the request itself, and the stretch
  // afterwards where the text is still being written out. The composer stays
  // in "stop" mode for both, so a reply can't be interrupted by a new one
  // halfway through appearing.
  const busy = loading || pending !== null;

  // Whether the user is currently parked at the bottom of the page. Scrolling
  // up during a reply is a deliberate act ("let me re-read that") and has to
  // win over the auto-follow, so this is what gates it.
  const stickToBottom = useRef(true);
  useEffect(() => {
    function onScroll() {
      const distanceFromBottom =
        document.documentElement.scrollHeight - (window.innerHeight + window.scrollY);
      stickToBottom.current = distanceFromBottom < 80;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Only the *length* of the streaming text, not the object: `pending` is
  // replaced on every delta, so depending on it re-ran this effect for every
  // token. With `behavior: "smooth"` that queued hundreds of mutually
  // cancelling animated scrolls a second — jank, and the user could not scroll
  // up while a reply streamed because they were dragged straight back down.
  const streamedChars = pending?.text.length ?? 0;
  useEffect(() => {
    const last = messages[messages.length - 1];
    // An animated scroll makes sense as a one-off ("something new arrived"),
    // never as a per-token follow. Reduced-motion users get no animation at all.
    const smooth = !reducedMotion && !busy ? ("smooth" as const) : ("auto" as const);

    if (busy || last?.role === "user") {
      if (!stickToBottom.current) return; // The user scrolled away, leave them there.
      endRef.current?.scrollIntoView({ behavior: smooth, block: "end" });
    } else if (last?.role === "assistant") {
      // Reply landed and finished writing: bring the top of the fresh result
      // into view so a long prompt opens at its start. Worth overriding the
      // stick-to-bottom check, it is the one moment the user is waiting for.
      stickToBottom.current = true;
      resultRef.current?.scrollIntoView({ behavior: smooth, block: "start" });
    }
  }, [messages, busy, streamedChars, reducedMotion]);

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
    setMessages((m) => [...m, { id: randomId(), role: "assistant", content: text }]);
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
    const next: Msg[] = [...messages, { id: randomId(), role: "user", content: text }];
    setInput("");
    return run(next, text);
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
    const edited: Msg = { id: randomId(), role: "user", content: text };
    const superseded = messages.slice(index).map((m) => m.id);
    return run([...base, edited], text, undefined, superseded);
  }

  /**
   * Der gemeinsame Kern von Senden und Neu-Erzeugen.
   *
   * `text` ist nur fuer den Fehlerfall da (zurueck in die Eingabe), `next` ist
   * der Verlauf, wie er nach dem Zug aussehen soll.
   */
  async function run(
    next: Msg[],
    text: string,
    replaceMessageId?: string,
    supersededMessageIds?: string[]
  ): Promise<string | null> {
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
    setJustFinished(false);
    setLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    // The route streams the reply as "delta" events (see /api/chat), a local
    // accumulator rather than reading `streamingReply` back: state updates
    // are async, this loop needs the exact running text on every iteration,
    // not whatever last rendered, and the abort branch below needs whatever
    // arrived so far too.
    let accumulated = "";
    let retryAfterSeconds: number | null = null;
    // `messages` stays complete for the transcript on screen; only the newest
    // turns go over the wire. The route forwards just the last 12 to the model
    // and clamps anything longer than this itself, so replaying the full
    // history was pure payload — a long chat sent hundreds of KB per turn to
    // have most of it discarded server-side.
    const wireMessages =
      next.length > MAX_TRANSCRIPT_MESSAGES ? next.slice(-MAX_TRANSCRIPT_MESSAGES) : next;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target,
          conversationId,
          projectId,
          messages: wireMessages,
          // Nur beim Neu-Erzeugen gesetzt (C-2). Die Route liest daran zwei
          // Dinge ab: die Frage nicht ein zweites Mal speichern, und die alte
          // Antwort erst wegnehmen, wenn die neue sicher steht.
          ...(replaceMessageId ? { replaceMessageId } : {}),
          ...(supersededMessageIds?.length ? { supersededMessageIds } : {}),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        // The route already tells us how long a 429 lasts; showing it beats
        // making the user guess when they may try again.
        retryAfterSeconds = typeof json.retryAfter === "number" ? json.retryAfter : null;
        throw new Error((json.detail as string | undefined) ?? "Chat fehlgeschlagen");
      }
      if (!res.body) throw new Error("Keine Antwort erhalten.");

      // Die Konversation kommt seit Planpunkt C-1 schon VOR dem ersten Token
      // (SSE-Ereignis `meta`), weil die Route sie zusammen mit der Frage
      // anlegt, bevor sie das Modell fragt. Frueh uebernommen heisst: ein
      // Reload mitten im Stream landet im richtigen Chat statt auf
      // /chats/new — und genau dort ist die Frage dann auch, was vorher nicht
      // der Fall war.
      //
      // Eigene Variable statt des `conversationId`-States als Wache: ein
      // setState wirkt nicht sofort, `done` saehe sonst weiterhin den alten
      // Wert und wuerde router.replace/refresh ein zweites Mal ausloesen.
      let adoptedId: string | null = null;
      const adoptConversation = (newId: string) => {
        if (adoptedId === newId) return;
        adoptedId = newId;
        // The route returns the conversation id on the first persisted turn;
        // hold onto it so every following turn appends to the same stored
        // chat. That first turn moves a fresh chat onto its canonical URL,
        // /chats/[id] for global chats, the project subroute for workspace
        // chats, and refreshes the server components so sidebar recents +
        // project chat lists pick it up.
        if (!conversationId) {
          if (!initialConversationId) {
            router.replace(
              projectId ? `/projects/${projectId}/chats/${newId}` : `/chats/${newId}`,
              { scroll: false }
            );
          }
          router.refresh();
        }
        setConversationId(newId);
      };

      for await (const { event, data } of parseSseEvents(res.body)) {
        if (event === "meta") {
          const { conversationId: newId } = JSON.parse(data) as { conversationId?: string };
          if (newId) adoptConversation(newId);
        } else if (event === "delta") {
          const { text: chunk } = JSON.parse(data) as { text: string };
          accumulated += chunk;
          setPending({ text: accumulated, complete: false });
        } else if (event === "error") {
          const { detail } = JSON.parse(data) as { detail: string };
          throw new StreamProtocolError(detail);
        } else if (event === "done") {
          const { conversationId: newId, persistError } = JSON.parse(data) as {
            conversationId?: string;
            persistError?: string;
          };
          // No text is coming any more; the reveal finishes writing what's
          // left and commits the message from its own callback.
          setPending({ text: accumulated, complete: true });
          // Normalerweise schon durch `meta` erledigt; bleibt als Rueckfall
          // fuer den Fall, dass ein Client dieses Ereignis nicht sieht.
          if (newId) adoptConversation(newId);
          if (persistError) {
            setPersistWarning(
              "Diese Antwort ist da, konnte aber gerade nicht gespeichert werden, bei einem Neuladen geht sie verloren."
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
        setPersistWarning(
          "Die Verbindung ist mitten in der Antwort abgebrochen. Lade die Seite neu, die Antwort ist eventuell schon gespeichert."
        );
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
        setError(e instanceof Error ? e.message : "Unbekannter Fehler");
        setRetryAfter(typeof retryAfterSeconds === "number" ? retryAfterSeconds : null);
      }
      return null;
    } finally {
      // Only the request is over here. A completed reply that is still being
      // written out keeps `busy` true through `pending` until it commits.
      setLoading(false);
    }
  }

  // The latest assistant reply is the current result, in the refine loop
  // every turn returns the updated, finished version, so "newest assistant
  // message" is always the thing to read. It gets promoted to a first-class
  // result panel; earlier turns stay a light conversation thread above it.
  const lastAssistantIndex = messages.reduce(
    (acc, m, i) => (m.role === "assistant" ? i : acc),
    -1
  );

  // What a screen reader actually needs to hear: that a reply started, and that
  // it finished — two discrete events, not the reply streaming in character by
  // character. The text itself stays readable at the user's own pace in the log
  // above (QA finding A-1).
  const liveStatus = loading
    ? "Finn schreibt…"
    : pending !== null
      ? "Antwort wird geschrieben…"
      : justFinished
        ? "Antwort fertig."
        : "";

  return (
    <div className="flex flex-col gap-5">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveStatus}
      </div>
      {/* min-h keeps this area (and the composer right below it) roughly the
          same height whether it's showing the empty state or a short first
          exchange, otherwise the composer visibly jumps up the moment the
          empty state's own min-height goes away after the first reply. */}
      <div className="min-h-[58dvh]">
        {messages.length === 0 ? (
          <ChatEmptyState heading={heading} />
        ) : (
          // role="log" WITHOUT a live region. It used to carry
          // aria-live="polite", which meant every text delta changed the
          // contents of a live region and screen readers re-announced the
          // growing reply token by token — unusable noise, on the one surface
          // that matters most here. Live regions are for finished status
          // messages, not for continuously growing text, so the announcements
          // moved to the dedicated status line below and this is just a
          // navigable log now.
          <div role="log" className="flex flex-col gap-6">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <ChatUserBubble
                  key={m.id}
                  content={m.content}
                  // Kein Bearbeiten waehrend eines laufenden Zugs: die Frage
                  // umzuschreiben, auf die gerade geantwortet wird, ergaebe
                  // einen Verlauf, der nicht zusammenpasst.
                  onEdit={busy ? undefined : (next) => void editMessage(m.id, next)}
                />
              ) : i === lastAssistantIndex ? (
                <div key={m.id} ref={resultRef} className="scroll-mt-24">
                  <ChatResultPanel
                    content={m.content}
                    projectId={projectId}
                    target={target}
                    savedPrompts={savedPrompts}
                  />
                </div>
              ) : (
                <ChatAssistantBubble key={m.id} content={m.content} index={i} />
              )
            )}
            {loading && pending === null && <ChatTyping />}
            {pending !== null && (
              <ChatStreamingReply
                text={pending.text}
                complete={pending.complete}
                onRevealed={commitReply}
              />
            )}
            {/* Only after the last character is written: the answer to "is it
                done, can I copy it now?". */}
            {justFinished && pending === null && <ChatFinishedMarker />}

            {/* Neu erzeugen (Planpunkt C-2). Sitzt unter der letzten Antwort,
                weil es sich auf genau die bezieht — und nur im Ruhezustand,
                damit es waehrend eines laufenden Zugs nicht mit dem
                Stopp-Knopf im Composer konkurriert.

                Fuer ein Werkzeug, dessen Versprechen "nicht Credits
                verbrennen" ist, ist das der passende Weg zurueck: eine Antwort
                nachschaerfen, ohne einen neuen Chat aufzumachen und den ganzen
                Kontext noch einmal zu bezahlen. */}
            {lastAssistantIndex !== -1 && !busy && pending === null && (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => void regenerate()}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-secondary transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                  Neu erzeugen
                </button>
              </div>
            )}
            <div ref={endRef} className="h-0 scroll-mb-32" />
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
        >
          <span>
            {error}
            {retryAfter !== null && ` Versuch es in ${formatRetryDelay(retryAfter)} nochmal.`}
          </span>
          {/* The failed message is back in the composer, so this just sends it
              again — the banner used to be a dead end with the input already
              cleared. Hidden while rate-limited: retrying then only produces
              the same 429. */}
          {retryAfter === null && input.trim() && (
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1 text-[12.5px] font-medium transition-colors hover:bg-destructive/10 disabled:opacity-60"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
              Erneut senden
            </button>
          )}
        </div>
      )}

      {persistWarning && (
        <div
          role="status"
          className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-warning"
        >
          {persistWarning}
        </div>
      )}

      {/* Voice mode swaps in for the composer rather than covering the page:
          the transcript above stays visible and scrollable throughout, so
          talking to Finn never feels like leaving the chat. It runs the same
          turn through the same `send`, so a spoken conversation lands in this
          transcript and is persisted exactly like a typed one. */}
      {voiceOpen ? (
        <VoiceBar onClose={() => setVoiceOpen(false)} onSubmit={send} />
      ) : (
        <ChatComposer
          input={input}
          onInputChange={setInput}
          placeholder={placeholder}
          loading={busy}
          onSend={() => send()}
          onStop={stop}
          onVoice={() => setVoiceOpen(true)}
          target={target}
          onTargetChange={setTarget}
        />
      )}
    </div>
  );
}
