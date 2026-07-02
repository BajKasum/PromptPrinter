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
  const { count } = await supabase
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id);

  const mode = project.type === "software" ? ("software" as const) : ("general" as const);

  return (
    <div>
      <FadeIn>
        <Link
          href={`/projects/${id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-foreground/55 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zur Übersicht
        </Link>
      </FadeIn>
      <Chat mode={mode} projectId={project.id} hasResults={(count ?? 0) > 0} />
    </div>
  );
}
