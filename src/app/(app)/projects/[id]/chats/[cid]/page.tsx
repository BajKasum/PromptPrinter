import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isUuid } from "@/shared/lib/uuid";
import { ArrowLeft } from "lucide-react";
import { Chat } from "@/features/chat/components/chat";
import { FadeIn } from "@/shared/motion/fade-in";
import { getProject } from "@/server/project";
import { createClient } from "@/server/supabase/server";
import { getFreePromptsLeft, getNeedsOwnKey, getSessionProfile, getSessionUser } from "@/server/session";
import { extractSavedPromptContents } from "@/shared/lib/saved-prompts";
import { SAVED_PROMPTS_LOAD_LIMIT } from "@/shared/lib/chat-limits";
import { loadConversationMessages } from "@/features/chat/lib/load-messages";
import { getT } from "@/server/i18n";
import { orThrow } from "@/server/supabase/query";
import { loadVersionTarget } from "@/server/prompt-version-target";

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
  if (!isUuid(cid)) notFound();
  const project = await getProject(id);

  const supabase = await createClient();
  const user = await getSessionUser();
  // Zusätzlich zur Kennung des Chats auf user_id eingegrenzt, als zweite
  // Schranke neben RLS. project.userId ist hier gesetzt: getProject() leitet
  // ohne Anmeldung auf /login um.
  const { data: convo } = orThrow(
    await supabase
    .from("conversations")
    .select("id, title, project_id")
    .eq("id", cid)
    .eq("user_id", project.userId)
    .maybeSingle(),
    "conversations"
  );

  if (!convo) notFound();
  // A chat that lives elsewhere gets forwarded to its true home.
  if (!convo.project_id) redirect(`/chats/${cid}`);
  if (convo.project_id !== id) redirect(`/projects/${convo.project_id}/chats/${cid}`);

  const [initialMessages, savedPromptRowsResult, profile, needsKey, freePromptsLeft, versionTarget] =
    await Promise.all([
      // Nachrichten samt Anhängen und Vorschau-Adressen. Die Abfrage (neueste
      // zuerst, mit Limit, dann umgedreht) steht in load-messages.ts.
      loadConversationMessages(supabase, project.userId, cid),
      // `outputs` statt nur einer Zählung: der Speichern-Knopf bekommt so die
      // Texte der gespeicherten Prompts und ist für sie von Anfang an gesperrt.
      // Die Texte stehen in der ausgelieferten Seite, deshalb nur die neuesten
      // SAVED_PROMPTS_LOAD_LIMIT. Ob das Projekt Ergebnisse hat, sagt `count`,
      // das alle Zeilen zählt. user_id zusätzlich zu RLS.
      supabase
        .from("saved_prompts")
        .select("outputs", { count: "exact" })
        .eq("project_id", id)
        .eq("user_id", project.userId)
        .order("created_at", { ascending: false })
        .limit(SAVED_PROMPTS_LOAD_LIMIT),
      getSessionProfile(),
      getNeedsOwnKey(),
    getFreePromptsLeft(),
    loadVersionTarget(supabase, project.userId, { conversationId: cid }),
    ]);
  const { data: savedPromptRows, count: resultCount } = orThrow(savedPromptRowsResult, "saved_prompts");

  const t = await getT();
  const name = profile?.display_name || user?.email?.split("@")[0] || null;
  const savedPrompts = extractSavedPromptContents(
    (savedPromptRows as { outputs: Record<string, unknown> | null }[] | null) ?? []
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
        versionTarget={versionTarget}
        name={name}
        needsKey={needsKey}
        freePromptsLeft={freePromptsLeft}
      />
    </div>
  );
}
