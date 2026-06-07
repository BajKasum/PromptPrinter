import { FadeIn } from "@/components/motion/fade-in";

const items = [
  {
    title: "Lähmung vor dem leeren Blatt",
    body: "Du hast die Idee, aber der blinkende Cursor in Claude oder Cursor blockiert dich stundenlang.",
  },
  {
    title: "Inkonsistenter Kontext",
    body: "Jeder neue Chat wiederholt denselben Kontext. Und die Hälfte der Zeit versteht das Modell den Stack trotzdem falsch.",
  },
  {
    title: "Brief-/Spec-Drift",
    body: "Das PRD liegt in Notion, Prompts in Chats, das Schema in deinem Kopf — nichts bleibt synchron.",
  },
];

export function Problem() {
  return (
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="max-w-2xl">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text mb-4">
            Das Problem
          </div>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
            Gute Ideen sterben in der Lücke zwischen Gedanke und Prompt.
          </h2>
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
