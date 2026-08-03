"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderInput, FolderKanban, Loader2 } from "lucide-react";
import { useToast } from "@/shared/ui/toast";
import { createClient } from "@/shared/supabase/client";

// Lets a global chat become a project chat after the fact, when a free
// conversation turns into real project work (REDESIGN.md, "In Projekt
// verschieben"). A plain conversations.project_id update via the RLS-scoped
// browser client, no new table, no API route.

type ProjectOption = { id: string; name: string };

export function MoveToProjectButton({
  chatId,
  userId,
  chatTitle,
}: {
  chatId: string;
  /** Owner, fuer das explizite user_id neben RLS (Defense-in-depth). */
  userId: string;
  chatTitle: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setProjects((data as ProjectOption[] | null) ?? []);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  async function moveTo(project: ProjectOption) {
    if (movingId) return;
    setMovingId(project.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("conversations")
      .update({ project_id: project.id })
      .eq("id", chatId)
      .eq("user_id", userId);
    setMovingId(null);
    if (error) {
      toast({
        title: "Verschieben fehlgeschlagen",
        description: "Bitte versuch es erneut.",
        variant: "error",
      });
      return;
    }
    setOpen(false);
    toast({
      title: "In Projekt verschoben",
      description: `„${chatTitle}“ lebt jetzt in „${project.name}“.`,
      variant: "success",
    });
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Chat „${chatTitle}“ in ein Projekt verschieben`}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
      >
        <FolderInput className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          <button
            aria-label="Schliessen"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-elevated">
            <div className="border-b border-border px-3.5 py-2.5 text-[12.5px] font-medium text-foreground">
              In Projekt verschieben
            </div>
            {!loaded ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : projects.length === 0 ? (
              <div className="px-3.5 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
                Noch kein Projekt angelegt.{" "}
                <Link
                  href="/projects"
                  className="text-accent-text underline underline-offset-2 hover:text-accent-text"
                  onClick={() => setOpen(false)}
                >
                  Leg eins an
                </Link>{" "}
                und komm hierher zurück.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto py-1">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void moveTo(p)}
                    disabled={movingId !== null}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-foreground/85 transition-colors hover:bg-surface-hover disabled:opacity-50"
                  >
                    <FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {movingId === p.id && (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
