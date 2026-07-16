"use client";

import { Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DolphinLoader } from "@/components/brand/dolphin-loader";
import { MarkdownMessage } from "@/components/app/chat-markdown";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";
import { downloadFile } from "@/lib/utils";

// The message-list rendering family: one component per row that can appear
// in the transcript (a user turn, an older assistant turn, the in-flight
// typing indicator). The current/newest assistant reply is its own thing,
// see chat-result-panel.tsx.

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
