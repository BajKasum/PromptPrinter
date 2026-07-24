import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Chat } from "@/components/app/chat";
import { FadeIn } from "@/components/motion/fade-in";
import { getProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Projekt-Chat" };

type Params = Promise<{ id: string; cid: string }>;

type DbMessage = { id: string; role: "user" | "assistant"; content: string };

// Ein Projekt-Chat auf seiner kanonischen Subroute (REDESIGN.md, Phase 3).
// Chat-vs-Workspace-Trennung: diese Route liegt bewusst ausserhalb der
// (workspace)-Gruppe (siehe ../(workspace)/layout.tsx), kein Rail, kein
// Projekt-Header hier. Ein ruhiger Gesprächsraum, der zum Projekt gehört,
// aber dessen Kontext-Fläche nicht mit ins Chatfenster zieht.
export default async function ProjectChatPage({ params }: { params: Params }) {
  const { id, cid } = await params;
  const project = await getProject(id);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: convo } = await supabase
    .from("conversations")
    .select("id, title, mode, target, project_id")
    .eq("id", cid)
    .maybeSingle();

  if (!convo) notFound();
  // A chat that lives elsewhere gets forwarded to its true home.
  if (!convo.project_id) redirect(`/chats/${cid}`);
  if (convo.project_id !== id) redirect(`/projects/${convo.project_id}/chats/${cid}`);

  const [{ data: rows }, { count: resultCount }, { data: profile }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, role, content")
      .eq("conversation_id", cid)
      .order("created_at", { ascending: true }),
    supabase
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id),
    // getProject already redirected to /login if unauthenticated, user.id is
    // safe here; the "" fallback just matches no row instead of throwing.
    supabase.from("profiles").select("display_name").eq("id", user?.id ?? "").maybeSingle(),
  ]);

  const initialMessages = (rows as DbMessage[] | null) ?? [];
  const mode = convo.mode === "software" ? ("software" as const) : ("general" as const);
  const name = profile?.display_name || user?.email?.split("@")[0] || null;

  return (
    <div className="mx-auto max-w-[900px]">
      <FadeIn>
        <div className="mb-4">
          <Link
            href={`/projects/${id}`}
            className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-foreground/55 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zur Übersicht
          </Link>
          <h2 className="truncate text-[18px] font-semibold leading-[1.2] tracking-[-0.01em] text-foreground">
            {convo.title as string}
          </h2>
        </div>
      </FadeIn>
      <Chat
        mode={mode}
        target={(convo.target as string | null) ?? undefined}
        projectId={project.id}
        initialMessages={initialMessages}
        initialConversationId={convo.id as string}
        hasResults={(resultCount ?? 0) > 0}
        name={name}
      />
    </div>
  );
}
