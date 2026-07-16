"use client";

import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

// The composer is subordinate to the result but always reachable: it sticks
// to the bottom of the viewport while the page scrolls, with a fade so the
// thread dissolves into it instead of colliding.
export function ChatComposer({
  input,
  onInputChange,
  placeholder,
  loading,
  onSend,
}: {
  input: string;
  onInputChange: (value: string) => void;
  placeholder: string;
  loading: boolean;
  onSend: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mb-4 bg-gradient-to-t from-background via-background to-background/0 pb-4 pt-5">
      <div className="rounded-2xl border border-border-strong bg-surface-raised p-2.5">
        <Textarea
          rows={2}
          value={input}
          placeholder={placeholder}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          className="min-h-[56px] resize-none border-0 bg-transparent px-2 focus:ring-0"
        />
        {/* No permanent "Enter sendet…" hint here, Enter-to-send is a
            convention every chat app already teaches; repeating it on every
            single message would be chrome, not help. */}
        <div className="mt-1 flex items-center justify-end gap-3 pl-2">
          <Button onClick={onSend} disabled={loading || !input.trim()} className="shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Senden
          </Button>
        </div>
      </div>
    </div>
  );
}
