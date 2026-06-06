"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Copy, Check, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { downloadFile } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "Hilf mir, einen Prompt zu schreiben, um Französisch-Vokabeln zu üben.",
  "Ich brauche einen Prompt, der mir einen Lernplan für meine Prüfung erstellt.",
  "Schreib mir einen Prompt für ein professionelles Bewerbungsschreiben.",
];

// Pull the first fenced block out of an assistant reply — that's the actual
// paste-ready prompt. Falls back to the whole message when there's no block.
function extractPrompt(content: string): string {
  const m = content.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  return (m?.[1] ?? content).trim();
}

export function Chat({ mode, target }: { mode: "general" | "software"; target?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, target, messages: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? "Chat fehlgeschlagen");
      setMessages((m) => [...m, { role: "assistant", content: json.reply as string }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-240px)] min-h-[440px]">
      <div className="flex-1 overflow-y-auto card-surface p-5 md:p-6">
        {messages.length === 0 ? (
          <EmptyState onPick={(t) => send(t)} disabled={loading} />
        ) : (
          <div className="space-y-5">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <UserBubble key={i} content={m.content} />
              ) : (
                <AssistantBubble key={i} content={m.content} index={i} />
              )
            )}
            {loading && <Typing />}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[13px] text-red-300">
          {error}
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <Textarea
          rows={2}
          value={input}
          placeholder="Beschreibe, wofür du einen Prompt brauchst…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="resize-none"
        />
        <Button onClick={() => send()} disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Senden
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-white/35">
        Enter sendet · Shift+Enter neue Zeile · dieser Chat wird noch nicht gespeichert.
      </p>
    </div>
  );
}

function EmptyState({ onPick, disabled }: { onPick: (t: string) => void; disabled: boolean }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-10">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08]">
        <Sparkles className="h-5 w-5 text-violet-300" strokeWidth={1.8} />
      </div>
      <h2 className="text-[18px] font-semibold text-white">Wofür brauchst du einen Prompt?</h2>
      <p className="mt-1 text-[13px] text-white/55 max-w-sm">
        Beschreib dein Ziel — ich bau dir einen fertigen Prompt und verfeinere ihn mit dir.
      </p>
      <div className="mt-5 w-full max-w-md space-y-2">
        {STARTERS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="w-full text-left rounded-lg border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 text-[13px] text-white/75 hover:border-white/20 hover:text-white transition-colors disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-violet-500/15 border border-violet-500/25 px-4 py-2.5 text-[13.5px] leading-relaxed text-white/90 whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({ content, index }: { content: string; index: number }) {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(extractPrompt(content));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function exportMd() {
    downloadFile(`prompt-${index + 1}.md`, content, "text/markdown");
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] w-full">
        <div className="rounded-2xl rounded-bl-sm border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[13.5px] leading-relaxed text-white/85 whitespace-pre-wrap">
          {content}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={copyPrompt}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Kopiert" : "Prompt kopieren"}
          </Button>
          <Button size="sm" variant="ghost" onClick={exportMd}>
            <Download className="h-3.5 w-3.5" />
            .md
          </Button>
        </div>
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex justify-start">
      <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[13px] text-white/55">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Schreibt…
      </div>
    </div>
  );
}
