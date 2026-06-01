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

  return (
    <StaggerItem>
      <Link href={`/projects/${project.id}`} className="block group">
        <div className="card-surface h-full p-5 group-hover:border-white/15 transition-colors">
          <div className="flex items-start justify-between mb-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-accent-soft border border-white/[0.08] flex items-center justify-center">
              <FolderKanban className="h-4 w-4 text-white/85" strokeWidth={1.8} />
            </div>
            <span
              className={`text-[10px] font-mono uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border ${
                isReady
                  ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/[0.06] text-amber-300"
              }`}
            >
              {project.status}
            </span>
          </div>
          <h3 className="text-[16px] font-semibold tracking-tight text-white mb-1">
            {project.name}
          </h3>
          <p className="text-[13px] text-white/55 mb-4 line-clamp-1">{project.audience}</p>
          {stack.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {stack.map((s) => (
                <span
                  key={s}
                  className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-white/65"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between text-[11.5px] text-white/45 pt-3 border-t border-white/[0.05]">
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
