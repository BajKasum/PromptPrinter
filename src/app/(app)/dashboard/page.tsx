import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FolderKanban,
  Sparkles,
  CreditCard,
  Star,
  MessageSquare,
  Code2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { ProjectCard, type ProjectRow } from "@/components/app/project-card";
import { ChatCard, type ConversationRow } from "@/components/app/chat-card";
import { relativeTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Start" };

// Always reflect the latest DB state — never serve a cached snapshot.
export const dynamic = "force-dynamic";

type ProjectQueryRow = Omit<ProjectRow, "generationCount" | "isFavorite"> & {
  is_favorite?: boolean | null;
  generations: { count: number }[] | null;
};

type ChatQueryRow = Omit<ConversationRow, "messageCount" | "projectId"> & {
  project_id?: string | null;
  messages: { count: number }[] | null;
};

// The single most recently touched thing — the one answer to "where do I
// continue?". Derived from the same project/chat data, no extra query.
type Resume = {
  kind: "chat" | "project";
  id: string;
  title: string;
  desc: string;
  badge: string;
  href: string;
  updated_at: string;
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
    supabase.from("profiles").select("plan, display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("conversations")
      .select("id, title, mode, target, project_id, updated_at, messages(count)")
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
    projectId: c.project_id ?? null,
  }));

  const favorites = projects.filter((p) => p.isFavorite).slice(0, 4);
  const projectsTotal = projects.length;
  const generationsTotal = projects.reduce((acc, p) => acc + (p.generationCount ?? 0), 0);
  const plan = profile?.plan ?? "free";
  const hasHistory = chats.length > 0 || projectsTotal > 0;

  const stats = [
    { label: "Projekte", value: String(projectsTotal), Icon: FolderKanban },
    { label: "Generierungen", value: String(generationsTotal), Icon: Sparkles },
    { label: "Plan", value: plan.charAt(0).toUpperCase() + plan.slice(1), Icon: CreditCard },
  ];

  // Pick the globally newest item across chats + projects as the resume target.
  const latestChat = chats[0];
  const latestProject = projects[0];
  const chatTime = latestChat ? new Date(latestChat.updated_at).getTime() : -Infinity;
  const projTime = latestProject ? new Date(latestProject.updated_at).getTime() : -Infinity;

  let resume: Resume | null = null;
  if (latestChat && chatTime >= projTime) {
    resume = {
      kind: "chat",
      id: latestChat.id,
      title: latestChat.title,
      desc: latestChat.target
        ? `Für ${latestChat.target}`
        : latestChat.mode === "software"
          ? "Software-Projekt"
          : "Alltags-Prompt",
      badge: latestChat.projectId
        ? "Paket fertig"
        : latestChat.mode === "software"
          ? "Software"
          : "Alltag",
      href: `/chat?id=${latestChat.id}`,
      updated_at: latestChat.updated_at,
    };
  } else if (latestProject) {
    resume = {
      kind: "project",
      id: latestProject.id,
      title: latestProject.name,
      desc: latestProject.audience ? `Für ${latestProject.audience}` : "Projekt",
      badge: latestProject.status === "ready" ? "Fertig" : "In Arbeit",
      href: `/projects/${latestProject.id}`,
      updated_at: latestProject.updated_at,
    };
  }

  // The overview lists drop whatever already headlines the continue panel, so
  // the newest item isn't shown twice.
  const recentChats = (resume?.kind === "chat"
    ? chats.filter((c) => c.id !== resume!.id)
    : chats
  ).slice(0, 6);
  const recentProjects = (resume?.kind === "project"
    ? projects.filter((p) => p.id !== resume!.id)
    : projects
  ).slice(0, 6);

  // Greet by the chosen display name; otherwise derive a tidy first name from
  // the email (drop separators/digits, capitalize) instead of showing the raw
  // local-part like "kasumbajrami7".
  const displayName = (profile?.display_name ?? "").trim();
  const emailName = (user.email ?? "")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, "")
    .trim()
    .split(" ")[0];
  const rawName = displayName || emailName;
  const firstName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : "";

  const ResumeIcon =
    resume?.kind === "project"
      ? FolderKanban
      : resume?.badge === "Software"
        ? Code2
        : MessageSquare;

  return (
    <div>
      {/* Greeting — Finn's own voice, no scoreboard. The "what next" lives in
          the continue panel right below, not in a row of corner buttons. */}
      <FadeIn>
        <div className="mb-7">
          <h1 className="text-[32px] md:text-[42px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
            {hasHistory
              ? `Willkommen zurück${firstName ? `, ${firstName}` : ""}.`
              : `Schön, dass du da bist${firstName ? `, ${firstName}` : ""}.`}
          </h1>
          <p className="mt-1.5 text-[14.5px] text-muted-foreground">
            {hasHistory
              ? "Ich hab alles so gelassen, wie du es verlassen hast."
              : "Erzähl mir dein Ziel, den Rest bauen wir zusammen."}
          </p>
        </div>
      </FadeIn>

      {/* CONTINUE HERO — the single most important thing on the page. Finn
          stands beside your next move (companion, not sticker) under a soft
          light from above (Finn's World, scoped via .dash-continue). */}
      {resume ? (
        <FadeIn>
          <section className="mb-12">
            <div className="dash-continue relative overflow-hidden rounded-2xl border border-border p-5 md:p-7 shadow-card">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4 md:items-center md:gap-5">
                  <AnimatedMascot
                    state="welcoming"
                    size={84}
                    priority
                    className="shrink-0 [&_img]:h-[60px] [&_img]:w-[60px] md:[&_img]:h-[84px] md:[&_img]:w-[84px]"
                  />
                  <div className="min-w-0">
                    <p className="mb-1.5 text-[12px] font-mono uppercase tracking-[0.09em] text-accent-text">
                      Weiter, wo du aufgehört hast
                    </p>
                    <h2 className="flex items-center gap-2 text-[19px] md:text-[22px] font-semibold tracking-[-0.01em] text-foreground">
                      <ResumeIcon className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:inline" strokeWidth={1.8} />
                      <span className="line-clamp-1">{resume.title}</span>
                    </h2>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      <span className="line-clamp-1">
                        {resume.desc} · {resume.badge} · zuletzt {relativeTime(resume.updated_at)}
                      </span>
                    </p>
                  </div>
                </div>
                <Button asChild size="lg" className="shrink-0 md:self-center">
                  <Link href={resume.href}>
                    {resume.kind === "chat" ? "Chat weiterführen" : "Projekt öffnen"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {/* Start something new — deliberately quiet next to "continue". */}
              <div
                data-tour="quick-actions"
                className="mt-6 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center"
              >
                <span className="text-[12.5px] text-muted-foreground sm:mr-1">Oder starte neu:</span>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/chat?mode=general"
                    title="Für alltägliche Prompts: Texte, Recherche und Ideen für ChatGPT, Claude & Co."
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] text-foreground/90 transition-colors hover:border-border-strong hover:bg-surface-hover"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-accent-text" strokeWidth={1.8} />
                    Alltags-Prompt
                  </Link>
                  <Link
                    href="/chat?mode=software"
                    title="Für ganze Software-Projekte: Plan, Datenbank und Prompts für Lovable, Cursor & Co."
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] text-foreground/90 transition-colors hover:border-border-strong hover:bg-surface-hover"
                  >
                    <Code2 className="h-3.5 w-3.5 text-accent-text" strokeWidth={1.8} />
                    Software-Projekt
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </FadeIn>
      ) : (
        // First-run: same prime slot, now an invitation instead of a resume.
        <FadeIn>
          <section className="mb-12">
            <div className="dash-continue relative overflow-hidden rounded-2xl border border-border p-8 md:p-10 shadow-card">
              <div className="flex flex-col items-center gap-4 text-center">
                <AnimatedMascot state="welcoming" size={104} priority />
                <div>
                  <p className="text-[16px] font-semibold text-foreground">Wo willst du loslegen?</p>
                  <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
                    Erzähl mir einfach dein Ziel im Chat. Den Rest bauen wir Schritt für
                    Schritt zusammen.
                  </p>
                </div>
              </div>
              <div
                className="mx-auto mt-7 grid max-w-2xl grid-cols-1 gap-3 md:grid-cols-2"
                data-tour="start-cards"
              >
                <Link
                  href="/chat?mode=general"
                  className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-ring/50 hover:bg-surface-hover"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-accent-text" strokeWidth={1.8} />
                    <span className="text-[14px] font-medium text-foreground">Alltags-Prompt</span>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                    Für alltägliche Prompts: Texte, Recherche und Ideen für ChatGPT, Claude &amp; Co.
                  </p>
                </Link>
                <Link
                  href="/chat?mode=software"
                  className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-ring/50 hover:bg-surface-hover"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-accent-text" strokeWidth={1.8} />
                    <span className="text-[14px] font-medium text-foreground">Software-Projekt</span>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                    Beschreib deine Idee, ich bau dir dein komplettes Paket: Plan, Prompts
                    und Datenbank für Lovable, Cursor &amp; Co.
                  </p>
                </Link>
              </div>
            </div>
          </section>
        </FadeIn>
      )}

      {/* Stats — demoted from a three-card cockpit to one quiet summary line.
          Same numbers, no longer the headline. Carries the tour anchor. */}
      <FadeIn>
        <div
          data-tour="stats"
          className="mb-12 flex flex-wrap items-center gap-x-6 gap-y-2.5"
        >
          {stats.map(({ label, value, Icon }) => (
            <span key={label} className="inline-flex items-center gap-2 text-[13px]">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
              <span className="font-mono uppercase tracking-[0.06em] text-muted-foreground">
                {label}
              </span>
              <span className="font-semibold tabular-nums text-foreground">{value}</span>
            </span>
          ))}
        </div>
      </FadeIn>

      {/* Pinned — quick access, deliberately NOT another card grid. Compact
          pills read as shortcuts, not archive. */}
      {favorites.length > 0 && (
        <section className="mb-10">
          <FadeIn>
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={1.8} />
                Angeheftet
              </h2>
              <Link
                href="/projects"
                className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Alle ansehen →
              </Link>
            </div>
          </FadeIn>
          <StaggerChildren className="flex flex-wrap gap-2">
            {favorites.map((p) => (
              <StaggerItem key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="group inline-flex items-center gap-2.5 rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 transition-colors hover:border-border-strong"
                >
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      p.status === "ready" ? "bg-success" : "bg-warning"
                    }`}
                  />
                  <span className="max-w-[200px] truncate text-[13.5px] font-medium text-foreground">
                    {p.name}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {p.generationCount ?? 0}
                  </span>
                </Link>
              </StaggerItem>
            ))}
          </StaggerChildren>
        </section>
      )}

      {/* Recent chats — secondary weight. Voice header, not "Letzte Chats". */}
      {recentChats.length > 0 && (
        <section className="mb-10">
          <FadeIn>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.01em] text-foreground">
                <MessageSquare className="h-4 w-4 text-accent-text" strokeWidth={1.8} />
                Zuletzt im Gespräch
              </h2>
              <Link
                href="/chats"
                className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Alle ansehen →
              </Link>
            </div>
          </FadeIn>
          <StaggerChildren className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {recentChats.map((c) => (
              <ChatCard key={c.id} conversation={c} />
            ))}
          </StaggerChildren>
        </section>
      )}

      {/* Projects — tertiary weight, the broad overview. */}
      {recentProjects.length > 0 && (
        <section>
          <FadeIn>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.01em] text-foreground">
                <FolderKanban className="h-4 w-4 text-accent-text" strokeWidth={1.8} />
                Deine Projekte
              </h2>
              <Link
                href="/projects"
                className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Alle ansehen →
              </Link>
            </div>
          </FadeIn>
          <StaggerChildren className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </StaggerChildren>
        </section>
      )}
    </div>
  );
}
