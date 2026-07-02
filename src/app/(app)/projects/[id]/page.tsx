import Link from "next/link";
import { Send } from "lucide-react";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
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
// Chats dieses Projekts — Composer oben, Verläufe darunter. Die alte
// Snapshot-Seite (Tabs + Refine-Anhängsel) ist in die Subrouten aufgegangen:
// Ergebnisse leben unter ./results, jeder Chat unter ./chats/[cid].
export default async function ProjectOverviewPage({ params }: { params: Params }) {
  const { id } = await params;
  const project = await getProject(id);

  const supabase = await createClient();
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

      <div className="mt-4">
        {chats.length === 0 ? (
          <FadeIn>
            <div className="card-surface p-8 text-center">
              <AnimatedMascot state="curious" size={72} priority className="mx-auto mb-3" />
              <p className="text-[14px] font-semibold text-foreground">
                Noch kein Chat in „{project.name}“
              </p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
                Starte oben den ersten — ich kenne dein Briefing und deine Struktur
                aus der Seitenleiste automatisch.
              </p>
            </div>
          </FadeIn>
        ) : (
          <FadeIn>
            <ChatList chats={chats} basePath={`/projects/${id}/chats`} />
          </FadeIn>
        )}
      </div>
    </div>
  );
}
