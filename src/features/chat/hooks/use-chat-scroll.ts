"use client";

import "client-only";

import { useRef, useEffect } from "react";
import { useReducedMotion } from "framer-motion";
import type { Msg } from "@/features/chat/lib/chat-wire";

// Das Scrollverhalten des Chats: dem Strom folgen, solange der Nutzer unten ist, und eine fertige Antwort an
// ihrem Anfang zeigen. Aus chat.tsx herausgeloest (M7).
export function useChatScroll({
  messages,
  busy,
  streamedChars,
}: {
  messages: Msg[];
  busy: boolean;
  streamedChars: number;
}) {
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
  return { endRef, resultRef };
}
