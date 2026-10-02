"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { createClient } from "@/shared/supabase/client";
import {
  attachmentPathsOfConversation,
  removeAttachmentObjects,
} from "@/shared/lib/attachment-storage";
import { relativeTime } from "@/shared/lib/utils";
import { MoveToProjectButton } from "@/features/chat/components/move-to-project";
import { useLocale, useT } from "@/shared/i18n/provider";
import { fmt, plural, rich } from "@/shared/i18n/format";
import { LOCALE_TAGS } from "@/shared/i18n/locales";

// The global chat list (REDESIGN.md, Phase 2): calm bordered rows instead of
// cards, the title is the content, the sidebar already carries resume. Each
// row can be renamed inline or deleted with an inline confirm; both go through
// the browser Supabase client (RLS scopes writes to the owner) and re-fetch
// the server components afterwards so list + sidebar recents stay in sync.

export type ChatListItem = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};

export function ChatList({
  chats,
  userId,
  basePath = "/chats",
}: {
  chats: ChatListItem[];
  /** Owner, fuer das explizite user_id neben RLS (Defense-in-depth). Reicht
   *  die aufrufende Server-Komponente durch, die den Nutzer ohnehin kennt. */
  userId: string;
  /** Where a row links to, "/chats" (global) or "/projects/[id]/chats". */
  basePath?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {chats.map((c) => (
        <ChatRow key={c.id} chat={c} userId={userId} basePath={basePath} />
      ))}
    </div>
  );
}

type RowMode = "view" | "rename" | "confirm-delete";

function ChatRow({
  chat,
  userId,
  basePath,
}: {
  chat: ChatListItem;
  userId: string;
  basePath: string;
}) {
  const t = useT();
  const locale = useLocale();
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
      .eq("id", chat.id)
      .eq("user_id", userId);
    setBusy(false);
    if (error) {
      toast({
        title: t.chat.renameFailed,
        description: t.chat.tryAgain,
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
    // Die Dateien der Anhaenge kaskadieren NICHT mit (nur ihre Zeilen), also
    // die Pfade einsammeln, solange die Zeilen noch da sind.
    const attachmentPaths = await attachmentPathsOfConversation(supabase, userId, chat.id);
    // Messages (and their attachment rows) cascade away with the conversation
    // (FK on delete cascade).
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", chat.id)
      .eq("user_id", userId);
    // Objekte erst entfernen, wenn die Zeilen wirklich weg sind: bei einem
    // Fehler stehen sie noch und zeigen auf diese Dateien.
    if (!error) await removeAttachmentObjects(supabase, attachmentPaths);
    setBusy(false);
    if (error) {
      toast({
        title: t.chat.deleteFailed,
        description: t.chat.tryAgain,
        variant: "error",
      });
      return;
    }
    toast({
      title: t.chat.deleted,
      description: fmt(t.chat.deletedBody, { title: chat.title }),
      variant: "success",
    });
    router.refresh();
  }

  const meta = [
    fmt(t.chat.lastActive, {
      time: relativeTime(chat.updatedAt, LOCALE_TAGS[locale].intl, t.time.justNow),
    }),
    plural(t.chat.messageCount, chat.messageCount, locale),
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
          aria-label={t.chat.newTitleLabel}
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
          aria-label={t.chat.saveTitle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          aria-label={t.chat.cancelRename}
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
          {rich(t.chat.confirmDelete, {
            title: <span className="font-medium">{chat.title}</span>,
          })}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="ghost" onClick={cancel} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void remove()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {t.common.delete}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-surface-hover">
      <Link href={`${basePath}/${chat.id}`} className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-foreground">{chat.title}</p>
        <p className="mt-0.5 truncate text-[12px] text-secondary">{meta}</p>
      </Link>
      {/* Permanently visible below md (QA finding K-2): opacity-0 gated purely
          on :hover leaves touch devices with no reliable way to reveal these
          actions at all, Safari's hover-simulation-on-first-tap is not
          something to depend on. Desktop keeps the hover/focus reveal. */}
      <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100">
        {/* Only global chats can be moved, a project chat already belongs
            to one, and moving between projects isn't a thing here. */}
        {basePath === "/chats" && (
          <MoveToProjectButton chatId={chat.id} userId={userId} chatTitle={chat.title} />
        )}
        <button
          type="button"
          onClick={() => setMode("rename")}
          aria-label={fmt(t.chat.renameLabel, { title: chat.title })}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setMode("confirm-delete")}
          aria-label={fmt(t.chat.deleteLabel, { title: chat.title })}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/[0.08] hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
