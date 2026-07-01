import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Sparkles, Clock, MessageSquare } from "lucide-react";
import { ProjectTabs, type ProjectTab } from "@/components/app/project-tabs";
import { Chat } from "@/components/app/chat";
import { DeleteProjectButton } from "@/components/app/delete-project";
import type { ProjectTools } from "@/components/app/project-card";
import { GENERAL_VARIANTS } from "@/prompts";
import { FadeIn } from "@/components/motion/fade-in";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Projekt" };

type Params = Promise<{ id: string }>;

type DbMessage = { role: "user" | "assistant"; content: string };

type ProjectRecord = {
  id: string;
  name: string;
  audience: string;
  idea: string;
  // Software projects carry the four build tools; general projects carry { target }.
  tools: (ProjectTools & { target?: string }) | null;
  type: string;
  status: string;
  updated_at: string;
};

const PLACEHOLDER =
  "_Noch keine Daten für diesen Abschnitt. Erstelle das Projekt neu, um ihn zu füllen._";

const SOFTWARE_TABS: ProjectTab[] = [
  { id: "overview", label: "Übersicht" },
  { id: "brief", label: "Produkt-Brief", group: "Planung" },
  { id: "prd", label: "PRD", group: "Planung" },
  { id: "master", label: "Master-Prompt", group: "Prompts" },
  { id: "frontend", label: "Frontend-Prompt", group: "Prompts" },
  { id: "backend", label: "Backend-Prompt", group: "Prompts" },
  { id: "schema", label: "Datenbank-Schema", group: "Technik" },
  { id: "security", label: "Sicherheits-Checkliste", group: "Technik" },
  { id: "marketing", label: "Marketing-Texte", group: "Go-Live" },
  { id: "seo", label: "SEO-Plan", group: "Go-Live" },
  { id: "deployment", label: "Deployment-Anleitung", group: "Go-Live" },
];

const GENERAL_TABS: ProjectTab[] = [
  { id: "overview", label: "Übersicht" },
  { id: "prompt", label: "Haupt-Prompt" },
  ...GENERAL_VARIANTS.map((v) => ({ id: v.key, label: v.label, group: "Varianten" })),
];

function buildOverview(p: ProjectRecord): string {
  const t = p.tools ?? {};
  const statusLabel = p.status === "ready" ? "Fertig" : "In Arbeit";
  return `# ${p.name} — Übersicht

**Status** ${statusLabel}  •  **Zielgruppe** ${p.audience}  •  **Aktualisiert** ${relativeTime(
    p.updated_at
  )}

## Idee
${p.idea}

## Stack
- **Master-Prompt** — ${t.master ?? "—"}
- **Frontend** — ${t.frontend ?? "—"}
- **Backend** — ${t.backend ?? "—"}
- **Datenbank** — ${t.database ?? "—"}

## Nächste Schritte
- **Master-Prompt** — in deinen KI-Assistenten einfügen, um das Scaffolding zu starten
- **Datenbank-Schema** — zuerst im Supabase SQL-Editor ausführen
- **Frontend-Prompt** — in Lovable oder v0 einfügen
`;
}

function buildGeneralOverview(p: ProjectRecord): string {
  const target = p.tools?.target ?? "deine KI";
  return `# ${p.name} — Übersicht

**Typ** Prompt-Projekt  •  **Ziel-KI** ${target}  •  **Aktualisiert** ${relativeTime(
    p.updated_at
  )}

## Ziel
${p.idea}

## Enthalten
- **Haupt-Prompt** — die ausgewogene, fertige Version
- **Varianten** — knapp & direkt, ausführlich & geführt, rollenbasiert

## So nutzt du es
Kopiere den Haupt-Prompt und füge ihn in ${target} ein. Greif zu einer Variante, wenn du einen anderen Ton oder mehr Führung brauchst.
`;
}

function toSoftwareOutputs(
  p: ProjectRecord,
  stored: Record<string, string>
): Record<string, string> {
  const pick = (key: string) => stored[key]?.trim() || PLACEHOLDER;
  return {
    overview: stored.overview?.trim() || buildOverview(p),
    brief: pick("brief"),
    prd: pick("prd"),
    master: pick("master"),
    frontend: pick("frontend"),
    backend: pick("backend"),
    schema: pick("schema"),
    security: pick("security"),
    marketing: pick("marketing"),
    seo: pick("seo"),
    deployment: pick("deployment"),
  };
}

function toGeneralOutputs(
  p: ProjectRecord,
  stored: Record<string, string>
): Record<string, string> {
  const pick = (key: string) => stored[key]?.trim() || PLACEHOLDER;
  return {
    overview: stored.overview?.trim() || buildGeneralOverview(p),
    prompt: pick("prompt"),
    variant_a: pick("variant_a"),
    variant_b: pick("variant_b"),
    variant_c: pick("variant_c"),
  };
}

export default async function ProjectDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS scopes this to the owner; a malformed id or foreign project → no row.
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, audience, idea, tools, type, status, updated_at")
    .eq("id", id)
    .maybeSingle<ProjectRecord>();

  if (error || !project) notFound();

  const { data: generation } = await supabase
    .from("generations")
    .select("outputs")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ outputs: Record<string, string> | null }>();

  const stored = generation?.outputs ?? {};
  const isGeneral = project.type === "general";
  const tabs = isGeneral ? GENERAL_TABS : SOFTWARE_TABS;
  const outputs = isGeneral
    ? toGeneralOutputs(project, stored)
    : toSoftwareOutputs(project, stored);

  const typeLabel = isGeneral ? "Prompt-Projekt" : "Software-Projekt";
  const subtitle = isGeneral
    ? `Für ${project.tools?.target ?? "deine KI"}`
    : project.audience
      ? `Für ${project.audience}`
      : null;

  // Phase 3: every project carries a refine-chat. Load the most recently active
  // one (if any) so reopening the project resumes the same conversation. RLS
  // scopes the read to the owner; project_id ties it to this packet.
  const { data: refineConvo } = await supabase
    .from("conversations")
    .select("id")
    .eq("project_id", id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  let refineMessages: DbMessage[] | undefined;
  let refineConversationId: string | undefined;
  if (refineConvo) {
    refineConversationId = refineConvo.id;
    const { data: rows } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", refineConvo.id)
      .order("created_at", { ascending: true });
    refineMessages = (rows as DbMessage[] | null) ?? [];
  }

  return (
    <div>
      <FadeIn>
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 text-[13px] text-foreground/55 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück zu Projekten
            </Link>
            <DeleteProjectButton projectId={project.id} projectName={project.name} />
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text mb-2">
                <Sparkles className="h-3 w-3" />
                {typeLabel}
              </div>
              <h1 className="text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
                {project.name}
              </h1>
              {subtitle && (
                <p className="mt-2 text-[14px] text-foreground/55">{subtitle}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-[12px] text-foreground/55">
              <Clock className="h-3.5 w-3.5" />
              <span>Aktualisiert {relativeTime(project.updated_at)}</span>
            </div>
          </div>
        </div>
      </FadeIn>
      <ProjectTabs projectName={project.name} tabs={tabs} outputs={outputs} />

      <FadeIn>
        <div className="mt-10 border-t border-border pt-8">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text mb-2">
            <MessageSquare className="h-3 w-3" />
            Im Chat verfeinern
          </div>
          <h2 className="text-[20px] md:text-[24px] leading-[1.1] tracking-[-0.02em] font-semibold text-foreground mb-1">
            Pass deine Prompts an
          </h2>
          <p className="text-[13px] text-foreground/55 mb-5 max-w-xl">
            Sag der KI, was du ändern willst. Sie kennt dein Projekt und gibt dir
            die aktualisierte Version zurück.
          </p>
          <Chat
            mode={isGeneral ? "general" : "software"}
            projectId={project.id}
            initialMessages={refineMessages}
            initialConversationId={refineConversationId}
          />
        </div>
      </FadeIn>
    </div>
  );
}
