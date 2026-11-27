import type { InstallStep } from "@/features/marketing/lib/terminal-data";

// Die nummerierte Anleitung auf /skill, /terminal und /mcp: Kreis mit Nummer, Überschrift, Text, Befehl. "accent" ist
// der Hauptweg im hellblauen Kasten, "plain" der Nebenweg auf heller Fläche (/terminal ohne Konto).

export type StepTone = "accent" | "plain";

const TONE: Record<StepTone, { list: string; number: string; body: string; code: string }> = {
  accent: {
    list: "mt-8 space-y-5",
    number:
      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/60 bg-surface-raised font-mono text-[13px] text-accent-text",
    body: "mt-1 text-[14.5px] leading-[1.6] text-foreground/75",
    code: "mt-3 overflow-x-auto rounded-xl border border-border bg-surface-raised px-4 py-3 font-mono text-[13px] leading-[1.6] text-foreground",
  },
  plain: {
    list: "mt-6 space-y-5",
    number:
      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface font-mono text-[13px] text-secondary",
    body: "mt-1 text-[14.5px] leading-[1.6] text-secondary",
    code: "mt-3 overflow-x-auto rounded-xl border border-border bg-surface px-4 py-3 font-mono text-[13px] leading-[1.6] text-foreground",
  },
};

export function StepList({ tone = "accent", children }: { tone?: StepTone; children: React.ReactNode }) {
  return <ol className={TONE[tone].list}>{children}</ol>;
}

export function Step({
  n,
  title,
  tone = "accent",
  children,
}: {
  n: number;
  title: string;
  tone?: StepTone;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span aria-hidden className={TONE[tone].number}>
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[16px] font-semibold text-foreground">{title}</h3>
        {children}
      </div>
    </li>
  );
}

export function StepBody({ tone = "accent", children }: { tone?: StepTone; children: React.ReactNode }) {
  return <p className={TONE[tone].body}>{children}</p>;
}

export function StepCode({ tone = "accent", children }: { tone?: StepTone; children: string }) {
  return (
    <pre className={TONE[tone].code}>
      <code>{children}</code>
    </pre>
  );
}

/** Die ganze Liste aus Daten. `formatBody` setzt den Text eines Schritts anders, etwa mit Code-Auszeichnung. */
export function InstallSteps({
  steps,
  tone = "accent",
  formatBody,
}: {
  steps: readonly InstallStep[];
  tone?: StepTone;
  formatBody?: (body: string) => React.ReactNode;
}) {
  return (
    <StepList tone={tone}>
      {steps.map((step, i) => (
        <Step key={step.title} n={i + 1} title={step.title} tone={tone}>
          <StepBody tone={tone}>{formatBody ? formatBody(step.body) : step.body}</StepBody>
          {step.code && <StepCode tone={tone}>{step.code}</StepCode>}
        </Step>
      ))}
    </StepList>
  );
}
