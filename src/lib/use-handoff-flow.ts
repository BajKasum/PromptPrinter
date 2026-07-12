"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Shared by PacketBridge (software packets) and PromptSave (general prompts):
// same three-stage choreography (confirm → building → done → redirect), same
// fetch/link/timing dance against /api/generate — the two components used to
// duplicate this almost line-for-line and only really differ in what extra
// fields they collect (audience+tools vs. target) and what copy they show.
// This hook owns the shared process; each component keeps its own fields,
// focus management, and wording.

export type HandoffStage = "idle" | "confirm" | "building" | "done";

export const NAME_LIMITS = { min: 2, max: 80 } as const;
export const IDEA_LIMITS = { min: 20, max: 5000 } as const;

// How long the "done" beat holds before navigating away — long enough to
// register as a handoff, short enough to stay out of the way (DESIGN.md's
// Finn-Physik pacing, ~0.6–0.9s).
const HANDOFF_DELAY_MS = 850;

// Once the real fetch resolves, hold a beat so the last checked-off group is
// actually visible before the card swaps to "done" — otherwise the checklist
// would jump straight to the delivering card mid-step.
const PROGRESS_COMPLETE_DELAY_MS = 400;

// Prefill helpers. Standalone: the first user turn names the project/prompt,
// the whole conversation becomes the idea text. Workspace: the project
// already has a name (never re-derived), and the idea leads with the
// project's own Anweisungen so the result reflects the whole briefing, not
// just this one chat.
function deriveName(userMessages: string[]): string {
  const first = (userMessages[0] ?? "").trim().replace(/\s+/g, " ");
  return first.length > 60 ? `${first.slice(0, 57)}…` : first;
}

function deriveIdea(userMessages: string[], instructionsPrefix?: string): string {
  const joined = userMessages.join("\n\n").trim();
  const combined = instructionsPrefix?.trim()
    ? `${instructionsPrefix.trim()}\n\n${joined}`
    : joined;
  return combined.slice(0, IDEA_LIMITS.max);
}

export function useHandoffFlow({
  autoOpen,
  userMessages,
  conversationId,
  existingProjectId,
  projectName,
  projectInstructions,
  onOpenChange,
}: {
  autoOpen: boolean;
  userMessages: string[];
  conversationId?: string;
  existingProjectId?: string;
  projectName?: string;
  projectInstructions?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<HandoffStage>(autoOpen ? "confirm" : "idle");
  const [error, setError] = useState<string | null>(null);
  // Drives BuildProgress: false while building, flips true the instant the
  // real fetch resolves so the checklist snaps to fully checked.
  const [buildComplete, setBuildComplete] = useState(false);

  const [name, setName] = useState(() => {
    if (!autoOpen) return "";
    return existingProjectId ? (projectName ?? "") : deriveName(userMessages);
  });
  const [idea, setIdea] = useState(() =>
    autoOpen ? deriveIdea(userMessages, projectInstructions) : ""
  );
  const prefilled = useRef(autoOpen);

  useEffect(() => {
    onOpenChange?.(stage !== "idle");
  }, [stage, onOpenChange]);

  function openConfirm() {
    // Prefill once from the conversation; afterwards the user's edits win,
    // even if they hop back into the chat and return.
    if (!prefilled.current) {
      prefilled.current = true;
      setName(existingProjectId ? (projectName ?? "") : deriveName(userMessages));
      setIdea(deriveIdea(userMessages, projectInstructions));
    }
    setError(null);
    setStage("confirm");
  }

  function close() {
    setStage("idle");
  }

  const nameOk = name.trim().length >= NAME_LIMITS.min && name.trim().length <= NAME_LIMITS.max;
  const ideaOk = idea.trim().length >= IDEA_LIMITS.min && idea.trim().length <= IDEA_LIMITS.max;

  async function run({
    extraBody,
    failureMessage,
    notSavedMessage,
    resultPath,
  }: {
    /** The type-specific fields (type + audience/tools, or type + target). */
    extraBody: Record<string, unknown>;
    /** Shown when the response isn't ok and carries no detail message. */
    failureMessage: string;
    /** "Couldn't be saved" lead-in — the hook appends the reason or a retry hint. */
    notSavedMessage: string;
    resultPath: (resultProjectId: string) => string;
  }) {
    setStage("building");
    setBuildComplete(false);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          idea: idea.trim(),
          ...extraBody,
          ...(existingProjectId ? { projectId: existingProjectId } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? failureMessage);
      const resultProjectId = json.projectId as string | undefined;
      if (!resultProjectId || resultProjectId === "demo" || json.persistError) {
        throw new Error(
          json.persistError
            ? `${notSavedMessage}: ${json.persistError}`
            : `${notSavedMessage}. Versuch es nochmal.`
        );
      }
      // Standalone only: tie this conversation to its new project so opening
      // it resumes the same chat. A workspace chat is already linked.
      if (!existingProjectId && conversationId) {
        try {
          const supabase = createClient();
          await supabase
            .from("conversations")
            .update({ project_id: resultProjectId })
            .eq("id", conversationId);
        } catch {
          // Linking failed — not worth blocking the handoff over.
        }
      }
      // Snap the checklist to fully checked and let that register on screen
      // before cutting to the delivering card — then the same wordless beat
      // as before leaving, so Finn visibly hands the result over instead of
      // the screen just cutting away.
      setBuildComplete(true);
      await new Promise((resolve) => window.setTimeout(resolve, PROGRESS_COMPLETE_DELAY_MS));
      setStage("done");
      await new Promise((resolve) => window.setTimeout(resolve, HANDOFF_DELAY_MS));
      router.push(resultPath(resultProjectId));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      setStage("confirm");
    }
  }

  return {
    stage,
    error,
    buildComplete,
    name,
    setName,
    idea,
    setIdea,
    nameOk,
    ideaOk,
    openConfirm,
    close,
    run,
  };
}
