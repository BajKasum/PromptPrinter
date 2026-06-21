import { FadeIn } from "@/components/motion/fade-in";
import { Mascot } from "@/components/brand/mascot";

// Universal, pre-technical pains — the kind anyone with an idea recognises,
// no PRD/Schema/Spec vocabulary required.
const items = [
  {
    title: "Die leere Seite",
    body: "Du öffnest ChatGPT mit deiner Idee — und erstarrst. Was tippst du überhaupt ein, damit etwas Brauchbares rauskommt?",
  },
  {
    title: "Immer wieder von vorne",
    body: "Jeder neue Chat fängt bei null an. Du erklärst deine App zum zehnten Mal, bevor irgendetwas Echtes passiert.",
  },
  {
    title: "Der Plan bleibt im Kopf",
    body: "Du weisst ungefähr, was du willst. Aber es landet nie geordnet auf dem Bildschirm — und die KI rät dann munter falsch.",
  },
];

export function Problem() {
  return (
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text mb-4">
              Kennst du das?
            </div>
            <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
              Eine Idee zu haben ist leicht. Anzufangen ist die Hölle.
            </h2>
          </div>
          {/* Overwhelmed dolphin — mirrors exactly how the visitor feels here. */}
          <Mascot
            src="/mascot/dolphin-sad.png"
            size={150}
            className="hidden shrink-0 md:block"
            alt="Der Delfin ist überfordert von der leeren Seite"
          />
        </div>
      </FadeIn>
      <div className="grid md:grid-cols-3 gap-4 mt-12">
        {items.map((it, i) => (
          <FadeIn key={it.title} delay={i * 0.08}>
            <div className="card-surface h-full">
              <div className="text-2xl font-mono text-foreground/25 mb-3">0{i + 1}</div>
              <h3 className="text-[17px] font-semibold tracking-tight text-foreground mb-2">
                {it.title}
              </h3>
              <p className="text-[14.5px] leading-[1.6] text-foreground/55">{it.body}</p>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
