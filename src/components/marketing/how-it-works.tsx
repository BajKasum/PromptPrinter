import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import { Pencil, Wrench, Cpu, Rocket } from "lucide-react";

const steps = [
  {
    n: "01",
    Icon: Pencil,
    title: "Idee eingeben",
    body: "Füge grobe Notizen, einen Einzeiler oder eine skizzenhafte User Story ein. Wir holen dich da ab, wo du startest.",
  },
  {
    n: "02",
    Icon: Wrench,
    title: "Tools wählen",
    body: "Wähle deinen KI-Assistenten, Frontend-Builder, Backend-Agenten und die Ziel-Datenbank.",
  },
  {
    n: "03",
    Icon: Cpu,
    title: "Generieren",
    body: "Die Engine strukturiert ein PRD, Master-Prompt, Frontend- & Backend-Prompts, Schema und Ops-Dokumente.",
  },
  {
    n: "04",
    Icon: Rocket,
    title: "Bauen",
    body: "Kopiere jeden Prompt in den Assistenten deiner Wahl und leg los. Oder exportiere alles.",
  },
];

export function HowItWorks() {
  return (
    <section className="container-x py-24 md:py-32 relative">
      <FadeIn>
        <div className="max-w-2xl mb-14">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-violet-300/80 mb-4">
            So funktioniert es
          </div>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-white">
            Von der Idee zum Blueprint in vier Schritten.
          </h2>
          <p className="mt-4 text-[17px] text-white/55 max-w-xl">
            Schluss mit dem ständigen Neueintippen von Kontext in jedem Chat. PromptPrinter
            stellt ein komplettes, tool-spezifisches Build-Packet zusammen.
          </p>
        </div>
      </FadeIn>

      <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map(({ n, Icon, title, body }) => (
          <StaggerItem key={n}>
            <div className="card-surface h-full relative group overflow-hidden">
              <div className="absolute top-5 right-5 font-mono text-[11px] tracking-[0.08em] text-white/35">
                {n}
              </div>
              <div className="h-10 w-10 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-5">
                <Icon className="h-4.5 w-4.5 text-white/85" strokeWidth={1.8} />
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight text-white mb-2">
                {title}
              </h3>
              <p className="text-[14px] leading-[1.6] text-white/55">{body}</p>
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>
    </section>
  );
}
