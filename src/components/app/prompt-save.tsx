"use client";

import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { BuildProgress, type BuildStep } from "@/components/app/build-progress";
import { useHandoffFlow, NAME_LIMITS, IDEA_LIMITS } from "@/lib/use-handoff-flow";
import { TOOL_OPTIONS } from "@/lib/tools";

// The save flow for an everyday (general) chat — the sibling of PacketBridge,
// not a merge with it: the fields and moment are genuinely different. A
// software chat has nothing to show until the bridge builds it; a general
// chat already hands over a finished prompt inline, so saving only makes
// sense once there's a reply worth keeping (see Chat's `hasAssistantReply`
// gate). The shared confirm→saving→done choreography (fetch, project-
// linking, timing, redirect) lives in useHandoffFlow — this component owns
// only what's specific to a general prompt: the target-assistant select and
// its own copy. Since Phase 2 the chat's handoff strip opens the confirm
// card directly (autoOpen); "Zurück zum Chat" then unmounts it via onBack
// instead of falling to idle.
//
// Saving re-runs /api/generate (type: "general") from the goal, the same
// pipeline the packet bridge uses — so the result is a polished main prompt
// plus three toned variants, not a literal copy of one chat reply. That's the
// honest framing in the copy below: "eine fertige Version", not "dieser Chat".
//
// Two destinations (REDESIGN.md — Handoff im Workspace): standalone creates a
// new project (global chats); when `existingProjectId` is set, the prompt is
// saved into the project this chat already belongs to instead, landing
// directly in its Ergebnisse — see PacketBridge for the identical pattern.

// Order matches /api/generate's general prompts object (prompt, then the
// three GENERAL_VARIANTS in their declared order) — chatCompleteSequential
// walks it in this same insertion order, so the sequence is real. A shorter,
// lighter version of PacketBridge's steps: this run is ~4 calls, not 10, so
// the wait is much shorter and doesn't need four groups — just the two
// natural phases, summing to the real observed ~35s for this pack.
const GENERAL_STEPS: BuildStep[] = [
  { key: "prompt", label: "Haupt-Prompt", group: "Haupt-Prompt", seconds: 12 },
  { key: "variant_a", label: "Knapp & direkt", group: "Varianten", seconds: 8 },
  { key: "variant_b", label: "Ausführlich & geführt", group: "Varianten", seconds: 8 },
  { key: "variant_c", label: "Rollenbasiert", group: "Varianten", seconds: 8 },
];

const TARGET_OPTIONS = TOOL_OPTIONS.master; // ["Claude", "ChatGPT", "Gemini"]

const selectClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-[13px] text-foreground transition-colors duration-200 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50";

export function PromptSave({
  userMessages,
  initialTarget,
  conversationId,
  onOpenChange,
  autoOpen = false,
  onBack,
  existingProjectId,
  projectName,
  projectInstructions,
}: {
  /** The user's own chat turns, oldest first — source for the prefills. */
  userMessages: string[];
  /** Pre-selects the target assistant if the chat already knows it. */
  initialTarget?: string;
  /** Set once the chat is persisted; links the conversation to the new project (standalone only — a workspace chat is already linked). */
  conversationId?: string;
  /** Lets the chat hide its composer while the save card is open. */
  onOpenChange?: (open: boolean) => void;
  /** Mount directly on the confirm card (the chat's handoff strip opened it). */
  autoOpen?: boolean;
  /** When set, "Zurück zum Chat" hands control back instead of showing idle. */
  onBack?: () => void;
  /** Set when this chat belongs to a project — save into it instead of creating a new one. */
  existingProjectId?: string;
  /** The workspace's own name, shown read-only instead of an editable field. */
  projectName?: string;
  /** The workspace's Anweisungen, prefixed into the idea prefill. */
  projectInstructions?: string;
}) {
  const {
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
  } = useHandoffFlow({
    autoOpen,
    userMessages,
    conversationId,
    existingProjectId,
    projectName,
    projectInstructions,
    onOpenChange,
  });

  const [target, setTarget] = useState(
    initialTarget && TARGET_OPTIONS.includes(initialTarget as (typeof TARGET_OPTIONS)[number])
      ? initialTarget
      : TARGET_OPTIONS[0]
  );
  const nameRef = useRef<HTMLInputElement | null>(null);
  const ideaRef = useRef<HTMLTextAreaElement | null>(null);

  // Focus the one thing worth reviewing: the name field when it's editable,
  // the goal text when it isn't (workspace mode — the name is the project's own).
  useEffect(() => {
    if (stage !== "confirm") return;
    (existingProjectId ? ideaRef : nameRef).current?.focus();
  }, [stage, existingProjectId]);

  const valid = nameOk && ideaOk;

  async function save() {
    if (!valid) return;
    await run({
      extraBody: { type: "general", target },
      failureMessage: "Speichern fehlgeschlagen.",
      notSavedMessage: "Konnte nicht gespeichert werden",
      resultPath: (resultProjectId) =>
        existingProjectId ? `/projects/${resultProjectId}/results` : `/projects/${resultProjectId}`,
    });
  }

  if (stage === "idle") {
    return (
      <div className="mt-3 flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-foreground/85">
          Guter Prompt dabei? Den heb ich dir auf.
        </p>
        <Button size="sm" variant="accent" onClick={openConfirm} className="shrink-0">
          <BookmarkPlus className="h-4 w-4" />
          Prompt speichern
        </Button>
      </div>
    );
  }

  if (stage === "building") {
    return (
      <div role="status" aria-live="polite" className="card-surface mt-3 p-5 md:p-6">
        <div className="mb-4 flex items-start gap-4">
          <AnimatedMascot state="organizing" size={56} className="shrink-0" />
          <div>
            <p className="text-[14.5px] font-medium text-foreground">Finn macht die Endversion.</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Haupt-Prompt plus drei Varianten. Einen Moment noch.
            </p>
          </div>
        </div>
        <BuildProgress steps={GENERAL_STEPS} complete={buildComplete} />
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="card-surface mt-3 flex items-center gap-4 p-5 md:p-6"
      >
        <AnimatedMascot state="delivering" size={64} className="shrink-0" />
        <div>
          <p className="text-[14.5px] font-medium text-foreground">Fertig — deine Version liegt bereit.</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Du wirst gleich weitergeleitet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="prompt-save-heading" className="card-surface mt-3 p-5 md:p-6">
      <div className="mb-5 flex items-start gap-3">
        <AnimatedMascot state="organizing" size={44} className="hidden shrink-0 sm:block" />
        <div>
          <h2
            id="prompt-save-heading"
            className="text-[16px] font-semibold tracking-[-0.01em] text-foreground"
          >
            {existingProjectId ? "Diesen Prompt erzeuge ich fürs Projekt." : "Den heb ich dir auf."}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {existingProjectId
              ? "Ich mach eine polierte Version mit drei Varianten draus. Landet direkt in Ergebnisse."
              : "Gib ihm einen Namen. Ich mach eine polierte Version mit drei Varianten draus."}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
        >
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_160px]">
          {existingProjectId ? (
            <div>
              <Label>Projekt</Label>
              <div className="mt-1.5 flex h-10 items-center rounded-lg border border-border bg-surface px-3 text-[13px] text-foreground/70">
                {name}
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="save-name">Name</Label>
              <Input
                id="save-name"
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={NAME_LIMITS.max}
                placeholder="Wie soll der Prompt heißen?"
                className="mt-1.5"
              />
            </div>
          )}
          <div>
            <Label htmlFor="save-target">Ziel-KI</Label>
            <select
              id="save-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className={`${selectClass} mt-1.5`}
            >
              {TARGET_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="save-idea">Worum geht&apos;s</Label>
          <Textarea
            id="save-idea"
            ref={ideaRef}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={IDEA_LIMITS.max}
            className="mt-1.5 min-h-[96px]"
          />
          {!ideaOk && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              Mindestens {IDEA_LIMITS.min} Zeichen. Je genauer, desto besser wird der Prompt.
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-col-reverse items-stretch gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" onClick={() => (onBack ? onBack() : close())}>
          Zurück zum Chat
        </Button>
        <div className="flex items-center gap-3 sm:justify-end">
          {!valid && (
            <p className="text-[12px] text-muted-foreground">
              {!nameOk ? "Gib ihm noch einen Namen." : "Beschreib es etwas ausführlicher."}
            </p>
          )}
          <Button variant="accent" onClick={save} disabled={!valid} className="shrink-0">
            <Check className="h-4 w-4" />
            {existingProjectId ? "Erzeugen" : "Speichern"}
          </Button>
        </div>
      </div>
    </section>
  );
}
