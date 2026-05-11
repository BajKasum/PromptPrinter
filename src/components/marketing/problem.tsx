import { FadeIn } from "@/components/motion/fade-in";

const items = [
  {
    title: "Blank-page paralysis",
    body: "You have the idea but staring at a blinking cursor in Claude or Cursor stalls you for hours.",
  },
  {
    title: "Inconsistent context",
    body: "Every new chat repeats the same context. Half the time the model still misunderstands the stack.",
  },
  {
    title: "Brief / spec drift",
    body: "PRD lives in Notion, prompts live in chats, schema lives in your head — nothing stays in sync.",
  },
];

export function Problem() {
  return (
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="max-w-2xl">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-violet-300/80 mb-4">
            The problem
          </div>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-white">
            Great ideas die in the gap between thought and prompt.
          </h2>
        </div>
      </FadeIn>
      <div className="grid md:grid-cols-3 gap-4 mt-12">
        {items.map((it, i) => (
          <FadeIn key={it.title} delay={i * 0.08}>
            <div className="card-surface h-full">
              <div className="text-2xl font-mono text-white/25 mb-3">0{i + 1}</div>
              <h3 className="text-[17px] font-semibold tracking-tight text-white mb-2">
                {it.title}
              </h3>
              <p className="text-[14.5px] leading-[1.6] text-white/55">{it.body}</p>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
