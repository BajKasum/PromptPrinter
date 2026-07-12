import Link from "next/link";
import { ArrowLeft, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectTabs, type ProjectTab } from "@/components/app/project-tabs";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { FadeIn } from "@/components/motion/fade-in";
import { GENERAL_VARIANTS } from "@/prompts";
import { getProject, type WorkspaceProject } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { countArtifacts } from "@/lib/artifacts";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ergebnisse" };

type Params = Promise<{ id: string }>;

type GenerationHistoryRow = {
  id: string;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
  outputs: Record<string, unknown> | null;
};

const PLACEHOLDER =
  "_Noch keine Daten für diesen Abschnitt. Erstelle das Ergebnis neu, um ihn zu füllen._";

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

// Fallback overview texts for legacy results whose stored bundle carries no
// own overview. Null-safe: since 0011 the generation inputs are nullable.
function buildSoftwareOverview(p: WorkspaceProject): string {
  const t = p.tools ?? {};
  return `# ${p.name} — Übersicht

**Zielgruppe** ${p.audience ?? "—"}  •  **Aktualisiert** ${relativeTime(p.updated_at)}

## Idee
${p.idea ?? "—"}

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

function buildGeneralOverview(p: WorkspaceProject): string {
  const target = p.tools?.target ?? p.context.target ?? "deine KI";
  return `# ${p.name} — Übersicht

**Typ** Prompt  •  **Ziel-KI** ${target}  •  **Aktualisiert** ${relativeTime(p.updated_at)}

## Ziel
${p.idea ?? "—"}

## Enthalten
- **Haupt-Prompt** — die ausgewogene, fertige Version
- **Varianten** — knapp & direkt, ausführlich & geführt, rollenbasiert

## So nutzt du es
Kopiere den Haupt-Prompt und füge ihn in ${target} ein. Greif zu einer Variante, wenn du einen anderen Ton oder mehr Führung brauchst.
`;
}

// Der Ergebnisse-Bereich des Workspace (REDESIGN.md, Phase 3): die früheren
// Projekt-Tabs + der Verlauf, jetzt als Zustand desselben Raums. Der
// Ergebnistyp wird aus der outputs-Form abgeleitet (master-Key = Paket,
// prompt-Key = Prompt), project.type ist nur noch der Fallback — so bleiben
// alle Altprojekte korrekt lesbar, ohne dass der Typ das Projekt definiert.
export default async function ProjectResultsPage({ params }: { params: Params }) {
  const { id } = await params;
  const project = await getProject(id);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: generationsRaw }, { count: chatCount }, { data: profile }] = await Promise.all([
    supabase
      .from("generations")
      .select("id, model, tokens_in, tokens_out, created_at, outputs")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id),
    // PDF export is Pro/Team (pricing-preview.tsx) — Free only gets Markdown.
    user
      ? supabase.from("profiles").select("plan, is_admin").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const canExportPdf = profile?.is_admin === true || profile?.plan === "pro" || profile?.plan === "team";

  const history = (generationsRaw as GenerationHistoryRow[] | null) ?? [];
  const stored = (history[0]?.outputs as Record<string, string> | undefined) ?? {};

  const backLink = (
    <Link
      href={`/projects/${id}`}
      className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-foreground/55 transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Zurück zur Übersicht
    </Link>
  );

  if (history.length === 0) {
    // A result only ever comes out of a chat's handoff strip (REDESIGN.md —
    // Handoff im Workspace) — so an empty Ergebnisse-Bereich must point there,
    // not dead-end. Whether a chat already exists decides the exact next step.
    const hasChats = (chatCount ?? 0) > 0;
    return (
      <FadeIn>
        {backLink}
        <div className="card-surface p-8 text-center">
          <AnimatedMascot state="waiting" size={72} priority className="mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-foreground">
            Noch keine Ergebnisse gespeichert
          </p>
          <p className="mx-auto mt-1 mb-5 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
            Hier landen deine gespeicherten Ergebnisse — komplette Prompt-Pakete
            und feine Prompts, mit allem Verlauf.{" "}
            {hasChats
              ? "Öffne einen Chat und erzeug von dort dein erstes Ergebnis."
              : "Starte einen Chat, dann erzeugst du von dort dein erstes Ergebnis."}
          </p>
          <Button asChild size="sm">
            <Link href={hasChats ? `/projects/${id}` : `/projects/${id}/chats/new`}>
              <MessageSquare className="h-4 w-4" />
              {hasChats ? "Zu deinen Chats" : "Ersten Chat starten"}
            </Link>
          </Button>
        </div>
      </FadeIn>
    );
  }

  const isGeneral =
    typeof stored.master === "string"
      ? false
      : typeof stored.prompt === "string"
        ? true
        : project.type === "general";

  const tabs = isGeneral ? GENERAL_TABS : SOFTWARE_TABS;
  const pick = (key: string) => stored[key]?.trim() || PLACEHOLDER;
  const outputs: Record<string, string> = isGeneral
    ? {
        overview: stored.overview?.trim() || buildGeneralOverview(project),
        prompt: pick("prompt"),
        variant_a: pick("variant_a"),
        variant_b: pick("variant_b"),
        variant_c: pick("variant_c"),
      }
    : {
        overview: stored.overview?.trim() || buildSoftwareOverview(project),
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

  return (
    <div>
      <FadeIn>
        <div className="mb-4">
          {backLink}
          <h2 className="text-[18px] font-semibold leading-[1.2] tracking-[-0.01em] text-foreground">
            Ergebnisse
          </h2>
        </div>
      </FadeIn>

      <ProjectTabs
        projectName={project.name}
        tabs={tabs}
        outputs={outputs}
        canExportPdf={canExportPdf}
      />

      <FadeIn>
        <div className="mt-8 border-t border-border pt-6">
          <div className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.08em] text-foreground/45">
            <Sparkles className="h-3 w-3" />
            Verlauf
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {history.map((g) => {
              const artifacts = countArtifacts(g.outputs);
              const tokens = (g.tokens_in ?? 0) + (g.tokens_out ?? 0);
              const hasModel = Boolean(g.model);
              return (
                <div
                  key={g.id}
                  className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
                >
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${
                      hasModel
                        ? "border-accent/30 bg-accent-subtle text-accent-text"
                        : "border-border bg-surface text-foreground/45"
                    }`}
                  >
                    {hasModel ? "KI" : "Vorschau"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground/70">
                    {artifacts} {artifacts === 1 ? "Artefakt" : "Artefakte"}
                    {tokens > 0 ? ` · ${tokens.toLocaleString("de-CH")} Tokens` : ""}
                  </span>
                  <span className="shrink-0 text-[12px] text-foreground/45">
                    {relativeTime(g.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
