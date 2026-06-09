import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import { Pencil, MessageSquare, Layers, Download } from "lucide-react";

const steps = [
  {
    n: "01",
    Icon: Pencil,
    title: "Idee reinwerfen",
    body: "Beschreib dein Ziel im Chat: ein Satz, grobe Notizen oder eine halbe User Story. Wir holen dich da ab, wo du startest.",
  },
  {
    n: "02",
    Icon: MessageSquare,
    title: "Gemeinsam schärfen",
    body: "PromptPrinter fragt nach Zielgruppe, Tools und Stack und verfeinert den Prompt Schritt für Schritt mit dir.",
  },
  {
    n: "03",
    Icon: Layers,
    title: "Packet bekommen",
    body: "Du erhältst PRD, Master-Prompt, Frontend- und Backend-Prompts, Schema und Ops-Dokumente, aufeinander abgestimmt.",
  },
  {
    n: "04",
    Icon: Download,
    title: "Kopieren oder exportieren",
    body: "Jedes Artefakt per Klick ins gewählte Tool, oder lade das ganze Packet als Markdown-Bundle.",
  },
];

export function HowItWorks() {
  return (
    <section className="container-x py-24 md:py-32 relative">
      <FadeIn>
        <div className="max-w-2xl mb-14">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text mb-4">
            So funktioniert es
          </div>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
            Von der Idee zum Blueprint in vier Schritten.
          </h2>
          <p className="mt-4 text-[17px] text-foreground/55 max-w-xl">
            Schluss mit dem ständigen Neueintippen von Kontext in jedem Chat. PromptPrinter
            stellt ein komplettes, tool-spezifisches Build-Packet zusammen.
          </p>
        </div>
      </FadeIn>

      <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map(({ n, Icon, title, body }) => (
          <StaggerItem key={n}>
            <div className="card-surface h-full relative group overflow-hidden">
              <div className="absolute top-5 right-5 font-mono text-[11px] tracking-[0.08em] text-foreground/35">
                {n}
              </div>
              <div className="h-10 w-10 rounded-lg bg-surface border border-border flex items-center justify-center mb-5">
                <Icon className="h-5 w-5 text-foreground/85" strokeWidth={1.8} />
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight text-foreground mb-2">
                {title}
              </h3>
              <p className="text-[14px] leading-[1.6] text-foreground/55">{body}</p>
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>
    </section>
  );
}
