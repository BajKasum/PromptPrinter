"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { derivePromptTitle } from "@/lib/saved-prompts";

type SaveState = "idle" | "saving" | "saved";

// The "Prompt speichern" affordance in a project chat's result panel: persists
// the current prompt into the project's Ergebnisse (a `generations` row with
// outputs = { prompt, title, target }). Zero extra model calls, it just keeps
// text the user already has. The insert goes through the RLS-scoped browser
// client (owner-only insert policy, 0001), the same pattern the project rail
// uses for its own writes, so no API route is needed. Only ever rendered for a
// project chat with an actual prompt to save (see chat-result-panel.tsx).
//
// QA finding F-7: without any dedup check, the same prompt could be saved
// arbitrarily often (the button re-arms itself after 2.5s). Fixed without a
// migration (option 3 in the finding): the page already knows which prompts
// are already saved for this project (see results/page.tsx's callers), so
// `initiallySaved` lets the button start — and stay — in the "saved" state
// for a prompt that's already in the project's Ergebnisse, disabling re-saves
// entirely instead of just delaying them.
export function SavePromptButton({
  projectId,
  prompt,
  target,
  initiallySaved = false,
}: {
  projectId: string;
  prompt: string;
  target?: string | null;
  initiallySaved?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, setState] = useState<SaveState>(initiallySaved ? "saved" : "idle");

  async function save() {
    if (state !== "idle") return;
    setState("saving");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setState("idle");
      toast({
        title: "Nicht angemeldet",
        description: "Melde dich an, um Prompts zu speichern.",
        variant: "error",
      });
      return;
    }

    const { error } = await supabase.from("generations").insert({
      project_id: projectId,
      user_id: user.id,
      outputs: {
        prompt,
        title: derivePromptTitle(prompt),
        ...(target ? { target } : {}),
      },
      model: null,
    });

    if (error) {
      setState("idle");
      toast({
        title: "Speichern fehlgeschlagen",
        description: "Der Prompt konnte nicht gespeichert werden.",
        variant: "error",
      });
      return;
    }

    setState("saved");
    toast({ title: "In Ergebnissen gespeichert", variant: "success" });
    // Refresh so the project's result counter (header + rail) picks it up.
    router.refresh();
    // Stays "saved" for good (no re-arm timer): this exact prompt is now in
    // the project's Ergebnisse, saving it again would just create a duplicate.
  }

  return (
    <button
      type="button"
      onClick={() => void save()}
      disabled={state !== "idle"}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[12px] text-foreground/70 transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-70"
    >
      {state === "saving" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === "saved" ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Bookmark className="h-3.5 w-3.5" />
      )}
      {state === "saving" ? "Speichert…" : state === "saved" ? "Gespeichert" : "Speichern"}
    </button>
  );
}
