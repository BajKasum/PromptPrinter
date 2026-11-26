"use client";

import "client-only";

import { useCallback, useEffect, useState } from "react";
import { fetchShareStatus, type ShareStatus } from "@/shared/lib/prompt-share-status";

/**
 * Der Stand der Freigabe eines gespeicherten Prompts, einmal je aufgeklappter Karte geladen (shared/lib/prompt-share-status.ts).
 * Die Leiste zum Teilen zeigt und ändert ihn, Bearbeiten und Wiederherstellen prüfen nach demselben Stand: teilt jemand
 * den Prompt, während der Editor offen ist, weiss der Editor es sofort. Geladen wird erst, wenn `enabled` gilt (die
 * Karte ist offen), und bei jedem Aufklappen neu; eine zugeklappte Karte fragt nichts ab.
 */
export function useShareStatus(promptId: string, enabled: boolean) {
  const [share, setShare] = useState<ShareStatus>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setShare({ status: "loading" });
    void fetchShareStatus(promptId).then((next) => {
      if (live) setShare(next);
    });
    return () => {
      live = false;
    };
  }, [promptId, enabled, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { share, setShare, reload };
}
