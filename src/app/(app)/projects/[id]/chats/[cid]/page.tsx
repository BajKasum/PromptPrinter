import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Chat } from "@/features/chat/components/chat";
import { FadeIn } from "@/shared/motion/fade-in";
import { getProject } from "@/server/project";
import { createClient } from "@/server/supabase/server";
import { getNeedsOwnKey, getSessionProfile, getSessionUser } from "@/server/session";
import { extractSavedPromptContents } from "@/shared/lib/saved-prompts";
import { loadConversationMessages } from "@/features/chat/lib/load-messages";
import { getT } from "@/server/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getT()).meta.projectChat };
}

type Params = Promise<{ id: string; cid: string }>;

// Ein Projekt-Chat auf seiner kanonischen Subroute (REDESIGN.md, Phase 3).
// Chat-vs-Workspace-Trennung: diese Route liegt bewusst ausserhalb der
// (workspace)-Gruppe (siehe ../(workspace)/layout.tsx), kein Rail, kein
// Projekt-Header hier. Ein ruhiger Gesprächsraum, der zum Projekt gehört,
// aber dessen Kontext-Fläche nicht mit ins Chatfenster zieht.
export default async function ProjectChatPage({ params }: { params: Params }) {
  const { id, cid } = await params;
  const project = await getProject(id);

  const supabase = await createClient();
  const user = await getSessionUser();
  // Explicit user_id alongside the id lookup: RLS-only defense-in-depth
  // before (Security-Audit finding L-3) — project.userId is guaranteed
  // non-null here since getProject() above already redirected an
  // unauthenticated caller to /login.
  const { data: convo } = await supabase
    .from("conversations")
    .select("id, title, project_id")
    .eq("id", cid)
    .eq("user_id", project.userId)
    .maybeSingle();

  if (!convo) notFound();
  // A chat that lives elsewhere gets forwarded to its true home.
  if (!convo.project_id) redirect(`/chats/${cid}`);
  if (convo.project_id !== id) redirect(`/projects/${convo.project_id}/chats/${cid}`);

  const [initialMessages, { data: generationRows, count: resultCount }, profile, needsKey] =
    await Promise.all([
      // Nachrichten samt Anhaengen und Vorschau-Adressen. Die Abfrage (neueste
      // zuerst, mit Limit, dann umgedreht, QA-Befund P-1) steht in
      // load-messages.ts.
      loadConversationMessages(supabase, project.userId, cid),
      // Selecting `outputs` (not just a head-count) also gives the save
      // button the already-saved prompt texts, so it can start disabled for a
      // prompt that's already in the project's Ergebnisse (F-7). Explicit
      // user_id alongside project_id: RLS-only defense-in-depth before
      // (Security-Audit L-3).
      supabase
        .from("generations")
        .select("outputs", { count: "exact" })
        .eq("project_id", id)
        .eq("user_id", project.userId),
      // getProject already redirected to /login if unauthenticated, user.id is
      // safe here; the "" fallback just matches no row instead of throwing.
      getSessionProfile(),
      getNeedsOwnKey(),
    ]);

  const t = await getT();
  const name = profile?.display_name || user?.email?.split("@")[0] || null;
  const savedPrompts = extractSavedPromptContents(
    (generationRows as { outputs: Record<string, unknown> | null }[] | null) ?? []
  );

  return (
    <div className="mx-auto max-w-[900px]">
      <FadeIn>
        <div className="mb-4">
          <Link
            href={`/projects/${id}`}
            className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-secondary transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t.pages.workspace.backToOverview}
          </Link>
          <h2 className="truncate text-[18px] font-semibold leading-[1.2] tracking-[-0.01em] text-foreground">
            {convo.title as string}
          </h2>
        </div>
      </FadeIn>
      <Chat
        projectId={project.id}
        initialMessages={initialMessages}
        initialConversationId={convo.id as string}
        hasResults={(resultCount ?? 0) > 0}
        savedPrompts={savedPrompts}
        name={name}
        needsKey={needsKey}
      />
    </div>
  );
}
