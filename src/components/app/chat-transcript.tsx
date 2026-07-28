"use client";

import { useEffect } from "react";
import { Copy, Check, Download } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { DolphinLoader } from "@/components/brand/dolphin-loader";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { MarkdownMessage } from "@/components/app/chat-markdown";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";
import { useSmoothStream } from "@/lib/use-smooth-stream";
import { downloadFile } from "@/lib/utils";

// The message-list rendering family: one component per row that can appear
// in the transcript (a user turn, an older assistant turn, the in-flight
// typing indicator, the reply being written, the finished marker). The
// current/newest assistant reply is its own thing, see chat-result-panel.tsx.

export function ChatUserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent-subtle border border-accent/30 px-4 py-2.5 text-[13.5px] leading-relaxed text-foreground whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

export function ChatAssistantBubble({ content, index }: { content: string; index: number }) {
  const { copied, copy } = useCopyToClipboard();

  function exportMd() {
    downloadFile(`prompt-${index + 1}.md`, content, "text/markdown");
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] w-full">
        <div className="rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3 text-[13.5px] leading-relaxed text-foreground/85">
          <MarkdownMessage content={content} />
        </div>
        {/* Message-level actions: copying the whole reply is the primary move and
            must exist even when the reply has no fenced prompt block. */}
        <div className="mt-1.5 flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => copy(content)}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Kopiert" : "Antwort kopieren"}
          </Button>
          <Button size="sm" variant="ghost" onClick={exportMd}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ChatTyping() {
  return (
    <div className="flex justify-start">
      <div className="inline-flex items-center rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-2.5">
        <DolphinLoader size={30} label="Schreibt…" />
      </div>
    </div>
  );
}

/**
 * The reply while it is being written. A plain preview bubble, not the
 * featured ChatResultPanel: until the text is complete there is nothing
 * sensible to copy or save yet, and offering the affordances early is exactly
 * what made it unclear whether a prompt was finished.
 *
 * Two things make the writing readable. The text is revealed through
 * useSmoothStream rather than painted per provider chunk, so it flows instead
 * of landing in blocks. And "Schreibt…" stays visible in the bubble's own
 * footer for as long as anything is still being written, so "still going" and
 * "done" are never ambiguous, the footer's disappearance (and the result panel
 * taking over) is the signal that it's safe to copy.
 *
 * `onRevealed` fires once the stream has closed AND the reveal has caught up
 * with it; the caller commits the message then, not when the stream closed.
 */
export function ChatStreamingReply({
  text: raw,
  complete,
  onRevealed,
}: {
  /** Raw accumulated text received so far. */
  text: string;
  /** Whether the stream has closed (no more text is coming). */
  complete: boolean;
  /** Called with the full text once it has been written out. */
  onRevealed: (text: string) => void;
}) {
  const { text, settled } = useSmoothStream(raw);

  useEffect(() => {
    if (complete && settled) onRevealed(raw);
  }, [complete, settled, raw, onRevealed]);

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[88%] rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3 text-[13.5px] leading-relaxed text-foreground/85">
        <MarkdownMessage content={text} />
        <div className="mt-2.5 flex items-center">
          <DolphinLoader size={22} label="Schreibt…" />
        </div>
      </div>
    </div>
  );
}

/**
 * The end of a turn: Finn, celebrating, right below the finished result.
 *
 * This exists because "is it done yet?" had no answer, a long prompt just
 * stopped growing at some point and you had to guess whether it was safe to
 * copy. A marker that can only appear after the last character is written
 * answers it without a spinner, a progress bar or a timer.
 *
 * The celebration is carried by the artwork plus a one-off entrance, then it
 * settles into the calm `float` loop rather than Finn's looping `cheer`: this
 * stays on screen for as long as you're reading the prompt, and a mascot
 * bouncing beside a document you're trying to read is exactly the "hectic"
 * DESIGN.md rules out.
 */
export function ChatFinishedMarker() {
  const reduce = useReducedMotion() ?? false;

  return (
    // Deliberately no role="status". This used to rely on the transcript being
    // a live region itself, which it no longer is (QA finding A-1: announcing a
    // reply as it streamed in was unusable noise). The "done" announcement now
    // comes from the single dedicated status line in chat.tsx, so a live region
    // here would only duplicate it — and compete with the persist warning's.
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
      className="flex items-center justify-center gap-2.5 pt-1"
    >
      <AnimatedMascot state="celebrating" size={40} motion="float" />
      <span className="text-[13px] text-secondary">Fertig, dein Prompt ist startklar.</span>
    </motion.div>
  );
}
