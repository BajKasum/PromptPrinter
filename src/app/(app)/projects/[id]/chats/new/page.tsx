import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Chat } from "@/features/chat/components/chat";
import { FadeIn } from "@/shared/motion/fade-in";
import { getProject } from "@/server/project";
import { normalizeTarget } from "@/features/chat/lib/target-tools";
import { createClient } from "@/server/supabase/server";
import { getSessionProfile, getSessionUser } from "@/server/session";
import { extractSavedPromptContents } from "@/shared/lib/saved-prompts";

export const dynamic = "force-dynamic";

export const metadata = { title: "Neuer Projekt-Chat" };

type Params = Promise<{ id: string }>;

// Ein frischer Chat innerhalb des Workspace: erbt Briefing + Struktur als
// Kontext (buildProjectContext im Chat-API), bekommt nach dem ersten Turn
// seine kanonische Subroute /projects/[id]/chats/[cid].
export default async function NewProjectChatPage({ params }: { params: Params }) {
  const { id } = await params;
  const project = await getProject(id);

  // Whether saved results exist decides the empty-state copy: refining
  // something vs. starting the project's first work.
  const supabase = await createClient();
  const user = await getSessionUser();
  const [{ data: generationRows, count }, profile] = await Promise.all([
    // Selecting `outputs` (not just a head-count) also gives the save button
    // the already-saved prompt texts, so it can start disabled for a prompt
    // that's already in the project's Ergebnisse (F-7). Explicit user_id
    // alongside project_id: RLS-only defense-in-depth (Security-Audit L-3).
    supabase
      .from("generations")
      .select("outputs", { count: "exact" })
      .eq("project_id", id)
      .eq("user_id", project.userId),
    // getProject already redirected to /login if unauthenticated, user.id is
    // safe here; the "" fallback just matches no row instead of throwing.
    getSessionProfile(),
  ]);
  const name = profile?.display_name || user?.email?.split("@")[0] || null;
  const savedPrompts = extractSavedPromptContents(
    (generationRows as { outputs: Record<string, unknown> | null }[] | null) ?? []
  );

  // A chat room, not a workspace panel (Chat-vs-Workspace-Trennung): no rail,
  // no project meta here, same narrow reading column the standalone chats
  // use, so a project chat feels like any other chat, just aware of its
  // project in the background. Only the back-link ties it to the workspace.
  return (
    <div className="mx-auto max-w-[900px]">
      <FadeIn>
        <Link
          href={`/projects/${id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zur Übersicht
        </Link>
      </FadeIn>
      <Chat
        // Seeded from the workspace rail's "Ziel-KI" so a project chat starts
        // knowing what the project already says it builds for.
        target={normalizeTarget(project.context.target)}
        projectId={project.id}
        hasResults={(count ?? 0) > 0}
        savedPrompts={savedPrompts}
        name={name}
      />
    </div>
  );
}
