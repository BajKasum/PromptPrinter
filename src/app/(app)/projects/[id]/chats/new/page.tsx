import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Chat } from "@/components/app/chat";
import { FadeIn } from "@/components/motion/fade-in";
import { getProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ count }, { data: profile }] = await Promise.all([
    supabase
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id),
    // getProject already redirected to /login if unauthenticated, user.id is
    // safe here; the "" fallback just matches no row instead of throwing.
    supabase.from("profiles").select("display_name").eq("id", user?.id ?? "").maybeSingle(),
  ]);
  const name = profile?.display_name || user?.email?.split("@")[0] || null;

  const mode = project.type === "software" ? ("software" as const) : ("general" as const);

  // A chat room, not a workspace panel (Chat-vs-Workspace-Trennung): no rail,
  // no project meta here, same narrow reading column the standalone chats
  // use, so a project chat feels like any other chat, just aware of its
  // project in the background. Only the back-link ties it to the workspace.
  return (
    <div className="mx-auto max-w-[900px]">
      <FadeIn>
        <Link
          href={`/projects/${id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-foreground/55 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zur Übersicht
        </Link>
      </FadeIn>
      <Chat
        mode={mode}
        projectId={project.id}
        hasResults={(count ?? 0) > 0}
        name={name}
      />
    </div>
  );
}
