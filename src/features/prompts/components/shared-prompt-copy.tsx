"use client";

import { Check, Copy } from "lucide-react";
import { useCopyToClipboard } from "@/shared/lib/use-copy-to-clipboard";

// Der Kopieren-Knopf der öffentlichen Seite /geteilt/<token>. Deutsch wie alle öffentlichen Seiten; die Seite selbst
// bleibt eine Server-Komponente, nur dieser Knopf läuft im Browser. Ohne Toast steht der Fehlschlag neben dem Knopf.

export function SharedPromptCopy({ content }: { content: string }) {
  const { copied, failed, copy } = useCopyToClipboard();
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <p role="status" className={failed ? "text-[13px] text-destructive" : "sr-only"}>
        {failed ? "Kopieren ging nicht. Markiere den Prompt oben und kopiere ihn selbst (Strg+C oder ⌘C)." : ""}
      </p>
      <button
        type="button"
        onClick={() => void copy(content)}
        className="focus-glow inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-accent-subtle px-3.5 text-[14px] font-medium text-accent-text transition-colors hover:bg-accent/25"
      >
        {copied ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? "Kopiert" : "Prompt kopieren"}
      </button>
    </div>
  );
}
