"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, Check } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { z } from "zod";

const TOOL_OPTIONS = {
  master: ["Claude", "ChatGPT", "Gemini"] as const,
  frontend: ["Lovable", "Stitch", "Figma", "v0"] as const,
  backend: ["Claude Code", "Cursor", "Windsurf"] as const,
  database: ["PostgreSQL", "MySQL", "Supabase"] as const,
};

const schema = z.object({
  name: z.string().min(2, "Gib einen Projektnamen ein."),
  idea: z.string().min(20, "Gib uns mindestens einen Satz, mit dem wir arbeiten können."),
  audience: z.string().min(2, "Für wen ist das?"),
  tools: z.object({
    master: z.enum(TOOL_OPTIONS.master),
    frontend: z.enum(TOOL_OPTIONS.frontend),
    backend: z.enum(TOOL_OPTIONS.backend),
    database: z.enum(TOOL_OPTIONS.database),
  }),
});

type FormState = z.infer<typeof schema>;

const STEPS = ["Name", "Idee", "Zielgruppe", "Tools", "Generieren"] as const;

export function Wizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<FormState>({
    name: "",
    idea: "",
    audience: "",
    tools: {
      master: "Claude",
      frontend: "Lovable",
      backend: "Claude Code",
      database: "Supabase",
    },
  });

  const validateStep = () => {
    if (step === 0 && state.name.trim().length < 2) return "Gib einen Projektnamen ein.";
    if (step === 1 && state.idea.trim().length < 20) return "Gib uns mindestens einen Satz.";
    if (step === 2 && state.audience.trim().length < 2) return "Für wen ist das?";
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  async function handleGenerate() {
    const parsed = schema.safeParse(state);
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
      {/* Progress */}
      <div className="mb-10">
        <div className="flex items-center gap-1">
          {STEPS.map((_, i) => (
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
            Schritt {step + 1} von {STEPS.length}
          </span>
          <span className="text-violet-300">{STEPS[step]}</span>
        </div>
      </div>

      <div className="gradient-border rounded-2xl">
        <div className="glass-strong rounded-2xl p-8 md:p-10 min-h-[360px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {step === 0 && (
                <StepWrap title="Benenne dein Projekt" sub="Gib deinem Build einen Arbeitstitel — du kannst ihn später ändern.">
                  <Label htmlFor="name">Projekt-Bezeichnung</Label>
                  <Input
                    id="name"
                    autoFocus
                    placeholder="z. B. Streak Coach"
                    value={state.name}
                    onChange={(e) => setState({ ...state, name: e.target.value })}
                  />
                </StepWrap>
              )}
              {step === 1 && (
                <StepWrap title="Beschreibe die rohe Idee" sub="Notizen, Fragmente, User Storys — was auch immer du hast. Wir strukturieren es.">
                  <Label htmlFor="idea">Die rohe Idee</Label>
                  <Textarea
                    id="idea"
                    autoFocus
                    rows={6}
                    placeholder="Ein Habit-Tracker, der mit KI Mikro-Belohnungen basierend auf dem Streak-Fortschritt vorschlägt…"
                    value={state.idea}
                    onChange={(e) => setState({ ...state, idea: e.target.value })}
                  />
                </StepWrap>
              )}
              {step === 2 && (
                <StepWrap title="Für wen ist das?" sub="Eine konkrete Zielgruppe erzeugt schärfere Artefakte als «alle».">
                  <Label htmlFor="audience">Zielgruppe</Label>
                  <Input
                    id="audience"
                    autoFocus
                    placeholder="z. B. Wissensarbeiter 25–40, die tägliche Routinen aufbauen"
                    value={state.audience}
                    onChange={(e) => setState({ ...state, audience: e.target.value })}
                  />
                </StepWrap>
              )}
              {step === 3 && (
                <StepWrap title="Wähle deine Tools" sub="Wir stimmen jede Ausgabe auf den Stack und die Assistenten ab, die du wirklich nutzt.">
                  <div className="space-y-5">
                    <ToolGroup
                      label="Master-Prompt"
                      options={TOOL_OPTIONS.master}
                      value={state.tools.master}
                      onChange={(v) => setState({ ...state, tools: { ...state.tools, master: v } })}
                    />
                    <ToolGroup
                      label="Frontend-Prompt"
                      options={TOOL_OPTIONS.frontend}
                      value={state.tools.frontend}
                      onChange={(v) => setState({ ...state, tools: { ...state.tools, frontend: v } })}
                    />
                    <ToolGroup
                      label="Backend-Prompt"
                      options={TOOL_OPTIONS.backend}
                      value={state.tools.backend}
                      onChange={(v) => setState({ ...state, tools: { ...state.tools, backend: v } })}
                    />
                    <ToolGroup
                      label="Datenbank"
                      options={TOOL_OPTIONS.database}
                      value={state.tools.database}
                      onChange={(v) => setState({ ...state, tools: { ...state.tools, database: v } })}
                    />
                  </div>
                </StepWrap>
              )}
              {step === 4 && (
                <StepWrap title="Bereit zum Generieren" sub="Wir erstellen ein komplettes Build-Packet — PRD, Prompts, Schema und Ops-Dokumente.">
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 text-[13px] space-y-2">
                    <Row k="Name" v={state.name} />
                    <Row k="Zielgruppe" v={state.audience} />
                    <Row k="Master" v={state.tools.master} />
                    <Row k="Frontend" v={state.tools.frontend} />
                    <Row k="Backend" v={state.tools.backend} />
                    <Row k="Datenbank" v={state.tools.database} />
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
            {step < STEPS.length - 1 ? (
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

function ToolGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "h-10 px-3 rounded-lg text-[13px] font-medium transition-all border",
                active
                  ? "border-violet-500/55 bg-violet-500/10 text-white"
                  : "border-white/[0.08] bg-white/[0.02] text-white/70 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
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
