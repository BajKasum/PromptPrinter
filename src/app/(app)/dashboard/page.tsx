import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, Sparkles, CreditCard, Star, MessageSquare, Code2 } from "lucide-react";
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
    <div>
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
              Willkommen zurück{firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className="mt-1 text-[14.5px] text-muted-foreground">
              {projectsTotal === 0
                ? "Noch keine Projekte — erstelle dein erstes Build-Packet."
                : `${projectsTotal} ${projectsTotal === 1 ? "Projekt" : "Projekte"} in deinem Workspace.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link
                href="/chat?mode=general"
                title="Für alltägliche Prompts — Texte, Recherche und Ideen für ChatGPT, Claude & Co."
              >
                <MessageSquare className="h-4 w-4" />
                Prompt Chat
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link
                href="/chat?mode=software"
                title="Für ganze Build-Pakete — PRD, Schema und Prompts für Lovable, Cursor & Co."
              >
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
                <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
                  {label}
                </span>
                <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
              </div>
              <div className="text-[32px] font-semibold tracking-[-0.02em] text-foreground">{value}</div>
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>

      {chats.length > 0 && (
        <section className="mb-10">
          <FadeIn>
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-[-0.01em] text-foreground">
                <MessageSquare className="h-4 w-4 text-accent-text" strokeWidth={1.8} />
                Letzte Chats
              </h2>
              <Link
                href="/chats"
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
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
              <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-[-0.01em] text-foreground">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" strokeWidth={1.8} />
                Favoriten
              </h2>
              <Link
                href="/library"
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
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
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-foreground">
            Letzte Projekte
          </h2>
          {projectsTotal > 0 && (
            <Link
              href="/projects"
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Alle ansehen →
            </Link>
          )}
        </div>
      </FadeIn>

      {recent.length === 0 ? (
        <FadeIn>
          <div className="card-surface p-8 md:p-10">
            <div className="text-center">
              <p className="text-[15px] text-foreground">Wähle deinen Startpunkt</p>
              <p className="mx-auto mt-1.5 mb-7 max-w-md text-[13px] text-muted-foreground">
                Beschreib dein Ziel im Chat — PromptPrinter baut dir den passenden
                Prompt, Schritt für Schritt mit dir verfeinert.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Link
                href="/chat?mode=general"
                className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-ring/50 hover:bg-surface-hover"
              >
                <div className="mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-accent-text" strokeWidth={1.8} />
                  <span className="text-[14px] font-medium text-foreground">Prompt Chat</span>
                </div>
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  Für alltägliche Prompts — Texte, Recherche und Ideen für ChatGPT,
                  Claude &amp; Co.
                </p>
              </Link>
              <Link
                href="/chat?mode=software"
                className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-ring/50 hover:bg-surface-hover"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-accent-text" strokeWidth={1.8} />
                  <span className="text-[14px] font-medium text-foreground">Prompt Code</span>
                </div>
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  Für ganze Build-Pakete — PRD, Schema und Prompts für Lovable,
                  Cursor &amp; Co.
                </p>
              </Link>
            </div>
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
