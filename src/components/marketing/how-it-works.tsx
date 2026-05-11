import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import { Pencil, Wrench, Cpu, Rocket } from "lucide-react";

const steps = [
  {
    n: "01",
    Icon: Pencil,
    title: "Enter idea",
    body: "Paste rough notes, a one-liner, or a sketchy user story. We meet you wherever you start.",
  },
  {
    n: "02",
    Icon: Wrench,
    title: "Choose tools",
    body: "Pick your AI assistant, frontend builder, backend agent, and database target.",
  },
  {
    n: "03",
    Icon: Cpu,
    title: "Generate",
    body: "Engine structures a PRD, master prompt, frontend & backend prompts, schema, and ops docs.",
  },
  {
    n: "04",
    Icon: Rocket,
    title: "Build",
    body: "Copy each prompt into your assistant of choice and start shipping. Or export everything.",
  },
];

export function HowItWorks() {
  return (
    <section className="container-x py-24 md:py-32 relative">
      <FadeIn>
        <div className="max-w-2xl mb-14">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-cyan-300/80 mb-4">
            How it works
          </div>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-white">
            From idea to blueprint in four steps.
          </h2>
          <p className="mt-4 text-[17px] text-white/55 max-w-xl">
            No more re-typing context in every chat. PromptPrinter assembles a complete,
            tool-specific build packet.
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
              <div className="h-10 w-10 rounded-lg bg-gradient-accent-soft border border-white/[0.08] flex items-center justify-center mb-5">
                <Icon className="h-4.5 w-4.5 text-white/85" strokeWidth={1.8} />
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight text-white mb-2">
                {title}
              </h3>
              <p className="text-[14px] leading-[1.6] text-white/55">{body}</p>
              <div className="pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-violet-500/0 group-hover:bg-violet-500/10 transition-colors duration-500 blur-2xl" />
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>
    </section>
  );
}
