import Link from "next/link";
import { redirect } from "next/navigation";
import { Send } from "lucide-react";
import { ChatList, type ChatListItem } from "@/components/app/chat-list";
import { FadeIn } from "@/components/motion/fade-in";
import { getProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Projekt" };

type Params = Promise<{ id: string }>;

type ConversationQueryRow = {
  id: string;
  title: string;
  target: string | null;
  updated_at: string;
  messages: { count: number }[] | null;
};

// Workspace-Übersicht (REDESIGN.md, Phase 3): die Hauptspalte gehört den
// Chats dieses Projekts, Composer oben, Verläufe darunter. Die alte
// Snapshot-Seite (Tabs + Refine-Anhängsel) ist in die Subrouten aufgegangen:
// Ergebnisse leben unter ./results, jeder Chat unter ./chats/[cid].
export default async function ProjectOverviewPage({ params }: { params: Params }) {
  const { id } = await params;
  // Resolves + ownership-scopes the project (404s otherwise); the name/fields
  // aren't needed on this page, unlike results/page.tsx's own call to this.
  await getProject(id);

  const supabase = await createClient();

  // A workspace with no chats yet had nothing on this page besides a card
  // whose entire content was "click here to start one" — the same action the
  // link right above it already offers, so reaching it cost an extra
  // navigation for no reason (QA finding N-2). Skip straight to the composer
  // instead. The rail (Anweisungen/Struktur/Dateien) is unaffected either
  // way, it lives in the shared workspace layout, not this page.
  const { count: chatCount } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id);
  if (!chatCount) redirect(`/projects/${id}/chats/new`);

  const { data: raw } = await supabase
    .from("conversations")
    .select("id, title, target, updated_at, messages(count)")
    .eq("project_id", id)
    .order("updated_at", { ascending: false });

  const chats: ChatListItem[] = ((raw as ConversationQueryRow[] | null) ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    target: c.target,
    updatedAt: c.updated_at,
    messageCount: c.messages?.[0]?.count ?? 0,
  }));

  return (
    <div>
      <FadeIn>
        <Link
          href={`/projects/${id}/chats/new`}
          className="group flex items-center justify-between gap-3 rounded-xl border border-border-strong bg-surface px-4 py-3 transition-colors hover:border-ring/50 hover:bg-surface-hover"
        >
          <span className="text-[13.5px] text-muted-foreground">
            Neuer Chat in diesem Projekt…
          </span>
          <Send className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
        </Link>
      </FadeIn>

      {/* chats is never empty here, the redirect above already sent a
          zero-chat project straight to the composer. */}
      <div className="mt-4">
        <FadeIn>
          <ChatList chats={chats} basePath={`/projects/${id}/chats`} />
        </FadeIn>
      </div>
    </div>
  );
}
