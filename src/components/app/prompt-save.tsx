"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { createClient } from "@/lib/supabase/client";
import { TOOL_OPTIONS } from "@/lib/tools";

// The save flow for an everyday (general) chat — the sibling of PacketBridge,
// not a merge with it: the fields and moment are genuinely different. A
// software chat has nothing to show until the bridge builds it; a general
// chat already hands over a finished prompt inline, so saving only makes
// sense once there's a reply worth keeping (see Chat's `hasAssistantReply`
// gate). Same three-stage choreography for a consistent feel: idle (slim
// offer bar) → confirm (editable summary) → saving → redirect.
//
// Saving re-runs /api/generate (type: "general") from the goal, the same
// pipeline the packet bridge uses — so the result is a polished main prompt
// plus three toned variants, not a literal copy of one chat reply. That's the
// honest framing in the copy below: "eine fertige Version", not "dieser Chat".

type Stage = "idle" | "confirm" | "saving";

const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  ideaMin: 20,
  ideaMax: 5000,
} as const;

const TARGET_OPTIONS = TOOL_OPTIONS.master; // ["Claude", "ChatGPT", "Gemini"]

const selectClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-[13px] text-foreground transition-colors duration-200 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50";

export function PromptSave({
  userMessages,
  initialTarget,
  conversationId,
  onOpenChange,
}: {
  /** The user's own chat turns, oldest first — source for the prefills. */
  userMessages: string[];
  /** Pre-selects the target assistant if the chat already knows it. */
  initialTarget?: string;
  /** Set once the chat is persisted; links the conversation to the new project. */
  conversationId?: string;
  /** Lets the chat hide its composer while the save card is open. */
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  const [target, setTarget] = useState(
    initialTarget && TARGET_OPTIONS.includes(initialTarget as (typeof TARGET_OPTIONS)[number])
      ? initialTarget
      : TARGET_OPTIONS[0]
  );
  const prefilled = useRef(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onOpenChange?.(stage !== "idle");
  }, [stage, onOpenChange]);

  useEffect(() => {
    if (stage === "confirm") nameRef.current?.focus();
  }, [stage]);

  function openConfirm() {
    // Prefill once from the conversation; afterwards the user's edits win, even
    // if they hop back into the chat and return.
    if (!prefilled.current) {
      prefilled.current = true;
      const first = (userMessages[0] ?? "").trim().replace(/\s+/g, " ");
      setName(first.length > 60 ? `${first.slice(0, 57)}…` : first);
      setIdea(userMessages.join("\n\n").trim().slice(0, LIMITS.ideaMax));
    }
    setError(null);
    setStage("confirm");
  }

  const nameOk =
    name.trim().length >= LIMITS.nameMin && name.trim().length <= LIMITS.nameMax;
  const ideaOk =
    idea.trim().length >= LIMITS.ideaMin && idea.trim().length <= LIMITS.ideaMax;
  const valid = nameOk && ideaOk;

  async function save() {
    if (!valid) return;
    setStage("saving");
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "general",
          name: name.trim(),
          idea: idea.trim(),
          target,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? "Speichern fehlgeschlagen.");
      const projectId = json.projectId as string | undefined;
      if (!projectId || projectId === "demo" || json.persistError) {
        throw new Error(
          json.persistError
            ? `Konnte nicht gespeichert werden: ${json.persistError}`
            : "Konnte nicht gespeichert werden. Versuch es nochmal."
        );
      }
      // Tie this conversation to its project so opening the project resumes the
      // same chat. Best effort: the prompt is saved either way.
      if (conversationId) {
        try {
          const supabase = createClient();
          await supabase
            .from("conversations")
            .update({ project_id: projectId })
            .eq("id", conversationId);
        } catch {
          // Linking failed — not worth blocking the save over.
        }
      }
      router.push(`/projects/${projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      setStage("confirm");
    }
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

  if (stage === "saving") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="card-surface mt-3 flex items-center gap-4 p-5 md:p-6"
      >
        <AnimatedMascot state="organizing" size={64} className="shrink-0" />
        <div>
          <p className="text-[14.5px] font-medium text-foreground">Finn macht die Endversion.</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Haupt-Prompt plus drei Varianten. Einen Moment noch.
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
            Den heb ich dir auf.
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Gib ihm einen Namen. Ich mach eine polierte Version mit drei Varianten draus.
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
          <div>
            <Label htmlFor="save-name">Name</Label>
            <Input
              id="save-name"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={LIMITS.nameMax}
              placeholder="Wie soll der Prompt heißen?"
              className="mt-1.5"
            />
          </div>
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
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={LIMITS.ideaMax}
            className="mt-1.5 min-h-[96px]"
          />
          {!ideaOk && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              Mindestens {LIMITS.ideaMin} Zeichen. Je genauer, desto besser wird der Prompt.
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-col-reverse items-stretch gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" onClick={() => setStage("idle")}>
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
            Speichern
          </Button>
        </div>
      </div>
    </section>
  );
}
