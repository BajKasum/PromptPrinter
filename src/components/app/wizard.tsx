"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, Check, MessageSquare, Code2 } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ToolGroup } from "@/components/app/tool-group";
import { TOOL_OPTIONS, DEFAULT_TOOLS, type ProjectTools } from "@/lib/tools";
import { generateRequestSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type PromptType = "software" | "general";

// Each pack defines its own step sequence. The pack itself is chosen by the
// mode toggle at the top (not a step), so each flow starts straight at its
// first field and is rendered by label to diverge without index juggling.
const STEP_DEFS: Record<PromptType, readonly string[]> = {
  software: ["Name", "Idee", "Zielgruppe", "Tools", "Generieren"],
  general: ["Titel", "Ziel", "Ziel-KI", "Generieren"],
};

type FormState = {
  type: PromptType;
  name: string;
  idea: string;
  audience: string;
  tools: ProjectTools;
  target: string;
};

export function Wizard({ initialTools = DEFAULT_TOOLS }: { initialTools?: ProjectTools }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<FormState>({
    type: "general",
    name: "",
    idea: "",
    audience: "",
    tools: initialTools,
    target: "ChatGPT",
  });

  const steps = STEP_DEFS[state.type];
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const set = (patch: Partial<FormState>) => setState((s) => ({ ...s, ...patch }));

  // Switching packs swaps the whole step sequence, so jump back to the first
  // field and clear any stale validation error.
  const selectType = (type: PromptType) => {
    if (type === state.type) return;
    setState((s) => ({ ...s, type }));
    setStep(0);
    setError(null);
  };

  const validateStep = (): string | null => {
    switch (current) {
      case "Name":
      case "Titel":
        return state.name.trim().length < 2 ? "Gib einen Namen ein (mind. 2 Zeichen)." : null;
      case "Idee":
      case "Ziel":
        return state.idea.trim().length < 20
          ? "Gib uns mindestens einen Satz (mind. 20 Zeichen)."
          : null;
      case "Zielgruppe":
        return state.audience.trim().length < 2 ? "Für wen ist das?" : null;
      case "Tools": {
        const t = state.tools;
        if (!t.master.trim() || !t.frontend.trim() || !t.backend.trim() || !t.database.trim())
          return "Bitte gib für jedes Tool einen Namen ein.";
        return null;
      }
      case "Ziel-KI":
        return state.target.trim().length < 1 ? "Wähle einen Ziel-Assistenten." : null;
      default:
        return null;
    }
  };

  const next = () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  function buildPayload() {
    return state.type === "general"
      ? { type: "general" as const, name: state.name, idea: state.idea, target: state.target }
      : {
          type: "software" as const,
          name: state.name,
          idea: state.idea,
          audience: state.audience,
          tools: state.tools,
        };
  }

  async function handleGenerate() {
    const parsed = generateRequestSchema.safeParse(buildPayload());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formular ungültig");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "Generierung fehlgeschlagen");

      const projectId: string | undefined = json.projectId;
      if (!projectId || projectId === "demo") {
        throw new Error(
          json.persistError
            ? `Projekt konnte nicht gespeichert werden: ${json.persistError}`
            : "Projekt konnte nicht gespeichert werden. Bist du eingeloggt?"
        );
      }

      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-[640px]">
      {/* Mode switch — pick the pack like the top bar in the reference UI. */}
      <div className="mb-7">
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
            <ModeButton
              active={state.type === "general"}
              icon={<MessageSquare className="h-4 w-4" />}
              label="Prompt Chat"
              disabled={submitting}
              onClick={() => selectType("general")}
            />
            <ModeButton
              active={state.type === "software"}
              icon={<Code2 className="h-4 w-4" />}
              label="Prompt Code"
              disabled={submitting}
              onClick={() => selectType("software")}
            />
          </div>
        </div>
        <p className="mt-3 text-center text-[12.5px] text-white/45">
          {state.type === "general"
            ? "Fertiger Prompt + Varianten für Alltag, Schule oder Arbeit."
            : "Komplettes Build-Packet für ein Software-Projekt."}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-10">
        <div className="flex items-center gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                i <= step ? "bg-violet-500" : "bg-white/[0.06]"
              )}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.08em]">
          <span className="text-white/55">
            Schritt {step + 1} von {steps.length}
          </span>
          <span className="text-violet-300">{current}</span>
        </div>
      </div>

      <div className="gradient-border rounded-2xl">
        <div className="glass-strong rounded-2xl p-8 md:p-10 min-h-[360px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${state.type}-${step}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {(current === "Name" || current === "Titel") && (
                <StepWrap
                  title={state.type === "general" ? "Benenne deinen Prompt" : "Benenne dein Projekt"}
                  sub="Ein kurzer Arbeitstitel — du kannst ihn später ändern."
                >
                  <Label htmlFor="name">
                    {state.type === "general" ? "Prompt-Titel" : "Projekt-Bezeichnung"}
                  </Label>
                  <Input
                    id="name"
                    autoFocus
                    placeholder={
                      state.type === "general" ? "z. B. Französisch-Vokabeln üben" : "z. B. Streak Coach"
                    }
                    value={state.name}
                    onChange={(e) => set({ name: e.target.value })}
                  />
                </StepWrap>
              )}

              {(current === "Idee" || current === "Ziel") && (
                <StepWrap
                  title={
                    state.type === "general" ? "Was soll der Prompt erreichen?" : "Beschreibe die rohe Idee"
                  }
                  sub={
                    state.type === "general"
                      ? "Beschreib dein Ziel und allen Kontext. Je konkreter, desto schärfer der Prompt."
                      : "Notizen, Fragmente, User Storys — was auch immer du hast. Wir strukturieren es."
                  }
                >
                  <Label htmlFor="idea">{state.type === "general" ? "Dein Ziel" : "Die rohe Idee"}</Label>
                  <Textarea
                    id="idea"
                    autoFocus
                    rows={6}
                    placeholder={
                      state.type === "general"
                        ? "Ich will ein Quiz, das mich beim Lernen der französischen Verben abfragt und meine Fehler erklärt…"
                        : "Ein Habit-Tracker, der mit KI Mikro-Belohnungen basierend auf dem Streak-Fortschritt vorschlägt…"
                    }
                    value={state.idea}
                    onChange={(e) => set({ idea: e.target.value })}
                  />
                </StepWrap>
              )}

              {current === "Zielgruppe" && (
                <StepWrap
                  title="Für wen ist das?"
                  sub="Eine konkrete Zielgruppe erzeugt schärfere Artefakte als «alle»."
                >
                  <Label htmlFor="audience">Zielgruppe</Label>
                  <Input
                    id="audience"
                    autoFocus
                    placeholder="z. B. Wissensarbeiter 25–40, die tägliche Routinen aufbauen"
                    value={state.audience}
                    onChange={(e) => set({ audience: e.target.value })}
                  />
                </StepWrap>
              )}

              {current === "Tools" && (
                <StepWrap
                  title="Wähle deine Tools"
                  sub="Wir stimmen jede Ausgabe auf den Stack und die Assistenten ab, die du wirklich nutzt."
                >
                  <div className="space-y-5">
                    <ToolGroup
                      label="Master-Prompt"
                      options={TOOL_OPTIONS.master}
                      value={state.tools.master}
                      onChange={(v) => set({ tools: { ...state.tools, master: v } })}
                    />
                    <ToolGroup
                      label="Frontend-Prompt"
                      options={TOOL_OPTIONS.frontend}
                      value={state.tools.frontend}
                      onChange={(v) => set({ tools: { ...state.tools, frontend: v } })}
                    />
                    <ToolGroup
                      label="Backend-Prompt"
                      options={TOOL_OPTIONS.backend}
                      value={state.tools.backend}
                      onChange={(v) => set({ tools: { ...state.tools, backend: v } })}
                    />
                    <ToolGroup
                      label="Datenbank"
                      options={TOOL_OPTIONS.database}
                      value={state.tools.database}
                      onChange={(v) => set({ tools: { ...state.tools, database: v } })}
                    />
                  </div>
                </StepWrap>
              )}

              {current === "Ziel-KI" && (
                <StepWrap
                  title="Für welchen Assistenten?"
                  sub="Wir schreiben den Prompt passend für die KI, in die du ihn einfügst."
                >
                  <ToolGroup
                    label="Ziel-Assistent"
                    options={TOOL_OPTIONS.master}
                    value={state.target}
                    onChange={(v) => set({ target: v })}
                  />
                </StepWrap>
              )}

              {current === "Generieren" && (
                <StepWrap
                  title="Bereit zum Generieren"
                  sub={
                    state.type === "general"
                      ? "Wir erstellen einen fertigen Prompt plus drei Varianten."
                      : "Wir erstellen ein komplettes Build-Packet — PRD, Prompts, Schema und Ops-Dokumente."
                  }
                >
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 text-[13px] space-y-2">
                    {state.type === "general" ? (
                      <>
                        <Row k="Titel" v={state.name} />
                        <Row k="Ziel-KI" v={state.target} />
                        <Row
                          k="Ziel"
                          v={state.idea.length > 80 ? `${state.idea.slice(0, 80)}…` : state.idea}
                        />
                      </>
                    ) : (
                      <>
                        <Row k="Name" v={state.name} />
                        <Row k="Zielgruppe" v={state.audience} />
                        <Row k="Master" v={state.tools.master} />
                        <Row k="Frontend" v={state.tools.frontend} />
                        <Row k="Backend" v={state.tools.backend} />
                        <Row k="Datenbank" v={state.tools.database} />
                      </>
                    )}
                  </div>
                </StepWrap>
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <div className="mt-5 rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[13px] text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
            <Button
              variant="ghost"
              onClick={back}
              disabled={step === 0 || submitting}
              className={cn(step === 0 && "invisible")}
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Button>
            {!isLast ? (
              <Button onClick={next} disabled={submitting}>
                Weiter
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleGenerate} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Drucke…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Generieren
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  icon,
  label,
  disabled,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors",
        active ? "bg-white/[0.08] text-white shadow-sm" : "text-white/55 hover:text-white",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StepWrap({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-white">{title}</h2>
      <p className="mt-1 text-[14px] text-white/55 mb-6">{sub}</p>
      <div>{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/45">{k}</span>
      <span className="text-white/85">{v || "—"}</span>
    </div>
  );
}
