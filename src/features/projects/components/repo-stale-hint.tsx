"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useT } from "@/shared/i18n/provider";

// Der Hinweis "Das Repo hat sich seit der Analyse vielleicht geändert" (#244). Er fragt selbst, wenn die Karte des
// Gedächtnisses erscheint (nie das Workspace-Layout) und bleibt bei jeder Unsicherheit still: GitHub nicht
// erreichbar, Limit, gelöschtes Repo, alter Eintrag. "Vielleicht", weil die Baum-SHA sich auch bei Doku oder
// Tests ändert, die die Analyse nie liest.
//
// Eine Antwort gilt in dieser Sitzung fünf Minuten je Analyse, damit das Wechseln zwischen Chats desselben
// Projekts nicht jedes Mal fragt.

const FRESH_MS = 5 * 60 * 1000;
const checked = new Map<string, { at: number; stale: boolean }>();

function freshAnswer(key: string): boolean | null {
  const hit = checked.get(key);
  return hit && Date.now() - hit.at < FRESH_MS ? hit.stale : null;
}

export function RepoStaleHint({ projectId, analyzedAt }: { projectId: string; analyzedAt: string | null }) {
  const t = useT();
  const key = `${projectId}:${analyzedAt ?? ""}`;
  const [fetched, setFetched] = useState<{ key: string; stale: boolean } | null>(null);

  useEffect(() => {
    if (freshAnswer(key) !== null) return;
    const controller = new AbortController();
    fetch(`/api/projects/${projectId}/brain/status`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as { stale?: unknown };
        const stale = body.stale === true;
        checked.set(key, { at: Date.now(), stale });
        setFetched({ key, stale });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [projectId, key]);

  const stale = freshAnswer(key) ?? (fetched?.key === key ? fetched.stale : false);
  if (!stale) return null;

  return (
    <p className="mt-2.5 flex items-start gap-1.5 rounded-md bg-accent-subtle px-2.5 py-2 text-[12px] leading-relaxed text-accent-text">
      <Sparkles className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
      {t.projects.brain.repoStaleHint}
    </p>
  );
}
