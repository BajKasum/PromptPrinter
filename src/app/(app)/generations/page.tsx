import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, ArrowRight, Layers, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import { createClient } from "@/lib/supabase/server";
import { countArtifacts } from "@/lib/artifacts";
import { relativeTime } from "@/lib/utils";

export const metadata = { title: "Generierungen" };

// Always reflect the latest run — never serve a cached snapshot.
export const dynamic = "force-dynamic";

type GenerationQueryRow = {
  id: string;
  project_id: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number | null;
  created_at: string;
  outputs: Record<string, unknown> | null;
  // Supabase types a to-one embed loosely; normalize defensively below.
  projects: { name: string } | { name: string }[] | null;
};

function projectNameOf(p: GenerationQueryRow["projects"]): string {
  if (!p) return "Unbenanntes Projekt";
  const obj = Array.isArray(p) ? p[0] : p;
  return obj?.name ?? "Unbenanntes Projekt";
}

export default async function GenerationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rawRows } = await supabase
    .from("generations")
    .select(
      "id, project_id, model, tokens_in, tokens_out, latency_ms, created_at, outputs, projects(name)"
    )
    .order("created_at", { ascending: false });

  const rows = (rawRows as GenerationQueryRow[] | null) ?? [];

  const total = rows.length;
  const artifactsTotal = rows.reduce((n, r) => n + countArtifacts(r.outputs), 0);
  const lastRun = rows[0] ? relativeTime(rows[0].created_at) : "—";

  const stats = [
    { label: "Läufe gesamt", value: String(total), Icon: Sparkles },
    { label: "Artefakte erzeugt", value: String(artifactsTotal), Icon: Layers },
    { label: "Letzter Lauf", value: lastRun, Icon: Clock },
  ];

  return (
    <div className="max-w-[1100px]">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-white">
              Generierungen
            </h1>
            <p className="mt-1 text-[14px] text-white/55">
              {total === 0
                ? "Jede KI-Ausführung wird hier protokolliert."
                : `${total} ${total === 1 ? "Lauf" : "Läufe"} in deinem Workspace.`}
            </p>
          </div>
          <Button asChild>
            <Link href="/new">
              <Plus className="h-4 w-4" />
              Neue Generierung
            </Link>
          </Button>
        </div>
      </FadeIn>

      {total === 0 ? (
        <FadeIn>
          <div className="card-surface p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08]">
              <Sparkles className="h-5 w-5 text-white/85" strokeWidth={1.8} />
            </div>
            <p className="text-[15px] text-white/80">Noch keine Generierungen</p>
            <p className="mt-1.5 text-[13px] text-white/45 max-w-sm mx-auto">
              Sobald du ein Projekt erstellst, erscheint hier jede KI-Ausführung mit den
              erzeugten Artefakten.
            </p>
            <Button asChild className="mt-5">
              <Link href="/new">
                <Plus className="h-4 w-4" />
                Erste Generierung starten
              </Link>
            </Button>
          </div>
        </FadeIn>
      ) : (
        <>
          <StaggerChildren className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            {stats.map(({ label, value, Icon }) => (
              <StaggerItem key={label}>
                <div className="card-surface p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-white/45">
                      {label}
                    </span>
                    <Icon className="h-4 w-4 text-white/40" strokeWidth={1.8} />
                  </div>
                  <div className="text-[32px] font-semibold tracking-[-0.02em] text-white">
                    {value}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerChildren>

          <FadeIn>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
              {rows.map((r) => {
                const name = projectNameOf(r.projects);
                const artifacts = countArtifacts(r.outputs);
                const tokens = (r.tokens_in ?? 0) + (r.tokens_out ?? 0);
                const hasModel = Boolean(r.model);
                const rowClass =
                  "group flex items-center gap-4 px-5 py-4 border-b border-white/[0.06] last:border-0 transition-colors";

                const content = (
                  <>
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-white/85" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-white truncate">{name}</span>
                        <span
                          className={`shrink-0 text-[10px] font-mono uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border ${
                            hasModel
                              ? "border-violet-500/30 bg-violet-500/[0.08] text-violet-200"
                              : "border-white/[0.08] bg-white/[0.04] text-white/45"
                          }`}
                        >
                          {hasModel ? "Claude" : "Vorlage"}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[12.5px] text-white/45">
                        {artifacts} {artifacts === 1 ? "Artefakt" : "Artefakte"}
                        {tokens > 0 ? ` · ${tokens.toLocaleString("de-CH")} Tokens` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 text-[12.5px] text-white/55 hidden sm:block">
                      {relativeTime(r.created_at)}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/25 group-hover:text-white/60 transition-colors" />
                  </>
                );

                return r.project_id ? (
                  <Link
                    key={r.id}
                    href={`/projects/${r.project_id}`}
                    className={`${rowClass} hover:bg-white/[0.025]`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={r.id} className={rowClass}>
                    {content}
                  </div>
                );
              })}
            </div>
          </FadeIn>
        </>
      )}
    </div>
  );
}
