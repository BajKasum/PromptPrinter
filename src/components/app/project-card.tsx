import Link from "next/link";
import { FolderKanban, Sparkles, Clock } from "lucide-react";
import { StaggerItem } from "@/components/motion/fade-in";
import { relativeTime } from "@/lib/utils";

export type ProjectTools = {
  master?: string;
  frontend?: string;
  backend?: string;
  database?: string;
};

export type ProjectRow = {
  id: string;
  name: string;
  audience: string;
  tools: ProjectTools | null;
  status: string;
  updated_at: string;
  generationCount?: number;
  isFavorite?: boolean;
};

// Derive a short, de-duplicated tech stack from the chosen tools.
function stackOf(tools: ProjectTools | null): string[] {
  if (!tools) return [];
  const picked = [tools.frontend, tools.backend, tools.database].filter(
    (v): v is string => Boolean(v)
  );
  return Array.from(new Set(picked));
}

export function ProjectCard({ project }: { project: ProjectRow }) {
  const stack = stackOf(project.tools);
  const isReady = project.status === "ready";
  const statusLabel = isReady ? "Fertig" : "In Arbeit";

  return (
    <StaggerItem>
      <Link href={`/projects/${project.id}`} className="block group">
        <div className="card-surface h-full p-5 group-hover:border-border-strong transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div className="h-9 w-9 rounded-lg bg-surface border border-border flex items-center justify-center">
              <FolderKanban className="h-4 w-4 text-foreground" strokeWidth={1.8} />
            </div>
            <span
              className={`text-[10px] font-mono uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border ${
                isReady
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-warning/30 bg-warning/10 text-warning"
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <h3 className="text-[16px] font-semibold tracking-tight text-foreground mb-1">
            {project.name}
          </h3>
          <p className="text-[13px] text-muted-foreground mb-4 line-clamp-1">{project.audience}</p>
          {stack.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {stack.map((s) => (
                <span
                  key={s}
                  className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between text-[11.5px] text-muted-foreground pt-3 border-t border-border">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              {project.generationCount ?? 0} Generierung
              {(project.generationCount ?? 0) === 1 ? "" : "en"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {relativeTime(project.updated_at)}
            </span>
          </div>
        </div>
      </Link>
    </StaggerItem>
  );
}
