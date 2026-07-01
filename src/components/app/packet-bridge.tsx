"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { createClient } from "@/lib/supabase/client";
import { TOOL_OPTIONS, type ProjectTools } from "@/lib/tools";

// The bridge from a software chat to a real build packet. The chat collects the
// idea conversationally; this component is the visible handoff: Finn summarizes
// what he understood into an editable confirmation card, then calls
// /api/generate (the packet pipeline) and moves the user into the new project.
//
// Stages: idle (slim offer bar) → confirm (editable summary) → building
// (Finn builds, everything locked) → redirect. Errors return to confirm.

type Stage = "idle" | "confirm" | "building";

// Compact labels for the four build-target choices (mirrors the settings page).
const TOOL_FIELDS: { key: keyof ProjectTools; label: string }[] = [
  { key: "master", label: "KI-Assistent" },
  { key: "frontend", label: "Frontend" },
  { key: "backend", label: "Backend" },
  { key: "database", label: "Datenbank" },
];

// Mirrors generateRequestSchema (software branch) so the card never submits a
// request the route would reject.
const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  ideaMin: 20,
  ideaMax: 5000,
  audienceMin: 2,
  audienceMax: 300,
} as const;

const selectClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-[13px] text-foreground transition-colors duration-200 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50";

export function PacketBridge({
  userMessages,
  defaultTools,
  conversationId,
  onOpenChange,
}: {
  /** The user's own chat turns, oldest first — source for the prefills. */
  userMessages: string[];
  /** Per-user tool defaults from profiles.settings (settings page maintains them). */
  defaultTools: ProjectTools;
  /** Set once the chat is persisted; links the conversation to the new project. */
  conversationId?: string;
  /** Lets the chat hide its composer while the handoff card is open. */
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [audience, setAudience] = useState("");
  const [idea, setIdea] = useState("");
  const [tools, setTools] = useState<ProjectTools>(defaultTools);
  const prefilled = useRef(false);
  const audienceRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onOpenChange?.(stage !== "idle");
  }, [stage, onOpenChange]);

  // The audience is the one field the chat can't derive — guide the eye there.
  useEffect(() => {
    if (stage === "confirm") audienceRef.current?.focus();
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
  const audienceOk =
    audience.trim().length >= LIMITS.audienceMin &&
    audience.trim().length <= LIMITS.audienceMax;
  const valid = nameOk && ideaOk && audienceOk;

  async function build() {
    if (!valid) return;
    setStage("building");
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "software",
          name: name.trim(),
          idea: idea.trim(),
          audience: audience.trim(),
          tools,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? "Generierung fehlgeschlagen.");
      const projectId = json.projectId as string | undefined;
      if (!projectId || projectId === "demo" || json.persistError) {
        throw new Error(
          json.persistError
            ? `Dein Paket konnte nicht gespeichert werden: ${json.persistError}`
            : "Dein Paket konnte nicht gespeichert werden. Versuch es nochmal."
        );
      }
      // Tie this conversation to its project so opening the project resumes the
      // same chat. Best effort: the packet exists either way.
      if (conversationId) {
        try {
          const supabase = createClient();
          await supabase
            .from("conversations")
            .update({ project_id: projectId })
            .eq("id", conversationId);
        } catch {
          // Linking failed — not worth blocking the handoff over.
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
          Genug erzählt? Dann mach ich daraus dein fertiges Paket.
        </p>
        <Button size="sm" variant="accent" onClick={openConfirm} className="shrink-0">
          <Package className="h-4 w-4" />
          Paket bauen
        </Button>
      </div>
    );
  }

  if (stage === "building") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="card-surface mt-3 flex items-center gap-4 p-5 md:p-6"
      >
        <AnimatedMascot state="building" size={64} className="shrink-0" />
        <div>
          <p className="text-[14.5px] font-medium text-foreground">Finn baut dein Paket.</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Plan, Prompts, Datenbank-Schema und mehr. Das kann einen Moment dauern.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="packet-bridge-heading"
      className="card-surface mt-3 p-5 md:p-6"
    >
      <div className="mb-5 flex items-start gap-3">
        <AnimatedMascot state="organizing" size={44} className="hidden shrink-0 sm:block" />
        <div>
          <h2
            id="packet-bridge-heading"
            className="text-[16px] font-semibold tracking-[-0.01em] text-foreground"
          >
            Das bau ich dir.
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Prüf kurz, ob ich alles richtig verstanden hab. Dann leg ich los.
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="bridge-name">Projektname</Label>
            <Input
              id="bridge-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={LIMITS.nameMax}
              placeholder="Wie soll dein Projekt heißen?"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="bridge-audience">Zielgruppe</Label>
            <Input
              id="bridge-audience"
              ref={audienceRef}
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              maxLength={LIMITS.audienceMax}
              placeholder="Wer soll das nutzen? z. B. Hobbyköche, kleine Teams"
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="bridge-idea">Deine Idee</Label>
          <Textarea
            id="bridge-idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={LIMITS.ideaMax}
            className="mt-1.5 min-h-[96px]"
          />
          {!ideaOk && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              Mindestens {LIMITS.ideaMin} Zeichen. Je genauer, desto besser wird dein Paket.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {TOOL_FIELDS.map(({ key, label }) => {
            const value = tools[key];
            const presets = TOOL_OPTIONS[key] as readonly string[];
            const options = presets.includes(value) ? presets : [value, ...presets];
            return (
              <div key={key}>
                <Label htmlFor={`bridge-tool-${key}`}>{label}</Label>
                <select
                  id={`bridge-tool-${key}`}
                  value={value}
                  onChange={(e) => setTools((t) => ({ ...t, [key]: e.target.value }))}
                  className={`${selectClass} mt-1.5`}
                >
                  {options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-col-reverse items-stretch gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" onClick={() => setStage("idle")}>
          Zurück zum Chat
        </Button>
        <div className="flex items-center gap-3 sm:justify-end">
          {!valid && (
            <p className="text-[12px] text-muted-foreground">
              {!audienceOk
                ? "Sag mir noch, wer das nutzen soll."
                : !nameOk
                  ? "Dein Projekt braucht noch einen Namen."
                  : "Beschreib die Idee etwas ausführlicher."}
            </p>
          )}
          <Button variant="accent" onClick={build} disabled={!valid} className="shrink-0">
            <Hammer className="h-4 w-4" />
            Paket bauen
          </Button>
        </div>
      </div>
    </section>
  );
}
