import Link from "next/link";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { ChatList, type ChatListItem } from "@/components/app/chat-list";
import { FadeIn } from "@/components/motion/fade-in";
import { getProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { LIST_LOAD_LIMIT, splitAtLimit } from "@/lib/chat-limits";

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
  // Resolves + ownership-scopes the project (404s otherwise). Also the source
  // of `userId` for the explicit defense-in-depth below (Security-Audit
  // finding L-3) — the fields aren't otherwise needed on this page, unlike
  // results/page.tsx's own call to this.
  const { userId } = await getProject(id);

  const supabase = await createClient();

  // One round trip, not two. This used to run a `count: exact, head: true`
  // query purely to decide the empty-state branch below, then immediately run
  // a second query selecting the same rows — the list itself already answers
  // "are there any", so the count was a serial round trip on the critical
  // path of every workspace visit for information the next query returns
  // anyway.
  //
  // Capped + over-fetched by one (see LIST_LOAD_LIMIT); the select was
  // unbounded before, same class of problem as /chats.
  const { data: raw } = await supabase
    .from("conversations")
    .select("id, title, target, updated_at, messages(count)")
    .eq("project_id", id)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .range(0, LIST_LOAD_LIMIT);

  const { items: rows, hasMore } = splitAtLimit(
    (raw as ConversationQueryRow[] | null) ?? []
  );

  // A workspace with no chats yet must stay put and let the user decide —
  // no server-side redirect into a chat, no auto-created conversation. The
  // N-2 "skip straight to the composer" shortcut from 23.07. did exactly
  // that behind the user's back: it fired on every visit while the query
  // resolved, on both the very first render AND any later revisit of an
  // empty project, with no way to just look at the dashboard. Replaced with
  // an explicit empty state; the "Neuen Chat starten" button is the only
  // thing that may navigate.
  if (rows.length === 0) {
    return (
      <FadeIn>
        <div className="card-surface p-8 text-center">
          <AnimatedMascot state="waiting" size={72} priority className="mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-foreground">Noch keine Chats</p>
          <p className="mx-auto mt-1 mb-5 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
            Starte den ersten Chat in diesem Projekt, Finn kennt dann schon
            Anweisungen, Struktur und Dateien aus der Rail.
          </p>
          <Button asChild size="sm">
            <Link href={`/projects/${id}/chats/new`}>
              <MessageSquare className="h-4 w-4" />
              Neuen Chat starten
            </Link>
          </Button>
        </div>
      </FadeIn>
    );
  }

  const chats: ChatListItem[] = rows.map((c) => ({
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

      {/* chats is never empty here, the branch above already returned its
          own empty state for that case. */}
      <div className="mt-4">
        <FadeIn>
          <ChatList chats={chats} basePath={`/projects/${id}/chats`} />
          {hasMore && (
            <p className="mt-4 text-center text-[12.5px] text-tertiary">
              Die neuesten {LIST_LOAD_LIMIT} Chats dieses Projekts.
            </p>
          )}
        </FadeIn>
      </div>
    </div>
  );
}
