import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, Plus, Sparkles, CreditCard, Star, MessageSquare, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import { ProjectCard, type ProjectRow } from "@/components/app/project-card";
import { ChatCard, type ConversationRow } from "@/components/app/chat-card";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

// Always reflect the latest DB state — never serve a cached snapshot.
export const dynamic = "force-dynamic";

type ProjectQueryRow = Omit<ProjectRow, "generationCount" | "isFavorite"> & {
  is_favorite?: boolean | null;
  generations: { count: number }[] | null;
};

type ChatQueryRow = Omit<ConversationRow, "messageCount"> & {
  messages: { count: number }[] | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rawProjects }, { data: profile }, { data: rawChats }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, audience, tools, status, updated_at, is_favorite, generations(count)")
      .order("updated_at", { ascending: false }),
    supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
    supabase
      .from("conversations")
      .select("id, title, mode, target, updated_at, messages(count)")
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  const projects: ProjectRow[] = ((rawProjects as ProjectQueryRow[] | null) ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    audience: p.audience,
    tools: p.tools,
    status: p.status,
    updated_at: p.updated_at,
    generationCount: p.generations?.[0]?.count ?? 0,
    isFavorite: p.is_favorite ?? false,
  }));

  const chats: ConversationRow[] = ((rawChats as ChatQueryRow[] | null) ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    mode: c.mode,
    target: c.target,
    updated_at: c.updated_at,
    messageCount: c.messages?.[0]?.count ?? 0,
  }));

  const favorites = projects.filter((p) => p.isFavorite).slice(0, 3);
  const projectsTotal = projects.length;
  const generationsTotal = projects.reduce((acc, p) => acc + (p.generationCount ?? 0), 0);
  const plan = profile?.plan ?? "free";

  const stats = [
    { label: "Projekte", value: String(projectsTotal), Icon: FolderKanban },
    { label: "Generierungen", value: String(generationsTotal), Icon: Sparkles },
    { label: "Plan", value: plan.charAt(0).toUpperCase() + plan.slice(1), Icon: CreditCard },
  ];

  const recent = projects.slice(0, 6);
  const firstName = (user.email ?? "").split("@")[0];

  return (
    <div className="max-w-[1100px]">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.03em] font-semibold text-white">
              Willkommen zurück{firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className="mt-1 text-[14.5px] text-white/55">
              {projectsTotal === 0
                ? "Noch keine Projekte — erstelle dein erstes Build-Packet."
                : `${projectsTotal} ${projectsTotal === 1 ? "Projekt" : "Projekte"} in deinem Workspace.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href="/chat?mode=general">
                <MessageSquare className="h-4 w-4" />
                Prompt Chat
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/new">
                <Code2 className="h-4 w-4" />
                Prompt Code
              </Link>
            </Button>
          </div>
        </div>
      </FadeIn>

      <StaggerChildren className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
        {stats.map(({ label, value, Icon }) => (
          <StaggerItem key={label}>
            <div className="card-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-white/45">
                  {label}
                </span>
                <Icon className="h-4 w-4 text-white/40" strokeWidth={1.8} />
              </div>
              <div className="text-[32px] font-semibold tracking-[-0.02em] text-white">{value}</div>
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>

      {chats.length > 0 && (
        <section className="mb-10">
          <FadeIn>
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-[-0.01em] text-white">
                <MessageSquare className="h-4 w-4 text-violet-300" strokeWidth={1.8} />
                Letzte Chats
              </h2>
              <Link
                href="/chats"
                className="text-[13px] text-white/55 hover:text-white transition-colors"
              >
                Alle ansehen →
              </Link>
            </div>
          </FadeIn>
          <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {chats.map((c) => (
              <ChatCard key={c.id} conversation={c} />
            ))}
          </StaggerChildren>
        </section>
      )}

      {favorites.length > 0 && (
        <section className="mb-10">
          <FadeIn>
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-[-0.01em] text-white">
                <Star className="h-4 w-4 fill-amber-300 text-amber-300" strokeWidth={1.8} />
                Favoriten
              </h2>
              <Link
                href="/library"
                className="text-[13px] text-white/55 hover:text-white transition-colors"
              >
                In der Bibliothek →
              </Link>
            </div>
          </FadeIn>
          <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {favorites.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </StaggerChildren>
        </section>
      )}

      <FadeIn>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-white">
            Letzte Projekte
          </h2>
          {projectsTotal > 0 && (
            <Link
              href="/projects"
              className="text-[13px] text-white/55 hover:text-white transition-colors"
            >
              Alle ansehen →
            </Link>
          )}
        </div>
      </FadeIn>

      {recent.length === 0 ? (
        <FadeIn>
          <div className="card-surface p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08]">
              <FolderKanban className="h-5 w-5 text-white/85" strokeWidth={1.8} />
            </div>
            <p className="text-[15px] text-white/80">Noch keine Projekte</p>
            <p className="mt-1.5 text-[13px] text-white/45 max-w-sm mx-auto">
              Beantworte fünf kurze Fragen und PromptPrinter erstellt ein komplettes,
              build-fertiges Prompt-Packet — gespeichert in deinem Supabase-Workspace.
            </p>
            <Button asChild className="mt-5">
              <Link href="/new">
                <Plus className="h-4 w-4" />
                Erstes Projekt erstellen
              </Link>
            </Button>
          </div>
        </FadeIn>
      ) : (
        <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {recent.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </StaggerChildren>
      )}
    </div>
  );
}
