"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/utils";
import { MoveToProjectButton } from "@/components/app/move-to-project";

// The global chat list (REDESIGN.md, Phase 2): calm bordered rows instead of
// cards, the title is the content, the sidebar already carries resume. Each
// row can be renamed inline or deleted with an inline confirm; both go through
// the browser Supabase client (RLS scopes writes to the owner) and re-fetch
// the server components afterwards so list + sidebar recents stay in sync.

export type ChatListItem = {
  id: string;
  title: string;
  target: string | null;
  updatedAt: string;
  messageCount: number;
};

export function ChatList({
  chats,
  basePath = "/chats",
}: {
  chats: ChatListItem[];
  /** Where a row links to, "/chats" (global) or "/projects/[id]/chats". */
  basePath?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {chats.map((c) => (
        <ChatRow key={c.id} chat={c} basePath={basePath} />
      ))}
    </div>
  );
}

type RowMode = "view" | "rename" | "confirm-delete";

function ChatRow({ chat, basePath }: { chat: ChatListItem; basePath: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<RowMode>("view");
  const [title, setTitle] = useState(chat.title);
  const [busy, setBusy] = useState(false);

  function cancel() {
    setTitle(chat.title);
    setMode("view");
  }

  async function rename() {
    const next = title.trim().slice(0, 80);
    if (!next || next === chat.title) {
      cancel();
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("conversations")
      .update({ title: next })
      .eq("id", chat.id);
    setBusy(false);
    if (error) {
      toast({
        title: "Umbenennen fehlgeschlagen",
        description: "Bitte versuch es erneut.",
        variant: "error",
      });
      return;
    }
    setMode("view");
    router.refresh();
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    // Messages cascade away with the conversation (FK on delete cascade).
    const { error } = await supabase.from("conversations").delete().eq("id", chat.id);
    setBusy(false);
    if (error) {
      toast({
        title: "Löschen fehlgeschlagen",
        description: "Bitte versuch es erneut.",
        variant: "error",
      });
      return;
    }
    toast({
      title: "Chat gelöscht",
      description: `„${chat.title}“ wurde entfernt.`,
      variant: "success",
    });
    router.refresh();
  }

  const meta = [
    chat.target ? `Für ${chat.target}` : null,
    `zuletzt ${relativeTime(chat.updatedAt)}`,
    `${chat.messageCount} Nachricht${chat.messageCount === 1 ? "" : "en"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  if (mode === "rename") {
    return (
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 last:border-0">
        <input
          autoFocus
          value={title}
          maxLength={80}
          aria-label="Neuer Chat-Titel"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void rename();
            } else if (e.key === "Escape") {
              cancel();
            }
          }}
          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-[13.5px] text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
        <button
          type="button"
          onClick={() => void rename()}
          disabled={busy}
          aria-label="Titel speichern"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          aria-label="Umbenennen abbrechen"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (mode === "confirm-delete") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 last:border-0">
        <p className="min-w-0 text-[13px] text-foreground/85">
          <span className="font-medium">„{chat.title}“</span> endgültig löschen?
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="ghost" onClick={cancel} disabled={busy}>
            Abbrechen
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void remove()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Löschen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-surface-hover">
      <Link href={`${basePath}/${chat.id}`} className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-foreground">{chat.title}</p>
        <p className="mt-0.5 truncate text-[12px] text-foreground/60">{meta}</p>
      </Link>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {/* Only global chats can be moved, a project chat already belongs
            to one, and moving between projects isn't a thing here. */}
        {basePath === "/chats" && (
          <MoveToProjectButton chatId={chat.id} chatTitle={chat.title} />
        )}
        <button
          type="button"
          onClick={() => setMode("rename")}
          aria-label={`Chat „${chat.title}“ umbenennen`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setMode("confirm-delete")}
          aria-label={`Chat „${chat.title}“ löschen`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/[0.08] hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
