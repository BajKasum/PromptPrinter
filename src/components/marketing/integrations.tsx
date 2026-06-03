import { Check } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";

const groups = [
  {
    title: "KI-Assistenten",
    items: ["Claude", "ChatGPT", "Gemini", "Mistral"],
  },
  {
    title: "Frontend-Builder",
    items: ["Lovable", "Stitch", "Figma", "v0"],
  },
  {
    title: "Backend-Agenten",
    items: ["Claude Code", "Cursor", "Windsurf", "Aider"],
  },
  {
    title: "Datenbanken",
    items: ["Supabase", "PostgreSQL", "MySQL", "Neon"],
  },
];

export function Integrations() {
  return (
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="max-w-2xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-violet-300/80 mb-4">
            Integrationen
          </div>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-white">
            Abgestimmt auf die Tools, die du bereits nutzt.
          </h2>
        </div>
      </FadeIn>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {groups.map((g, i) => (
          <FadeIn key={g.title} delay={i * 0.06}>
            <div className="card-surface h-full">
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/45 mb-4">
                {g.title}
              </div>
              <ul className="space-y-2">
                {g.items.map((it) => (
                  <li
                    key={it}
                    className="flex items-center justify-between text-[14px] text-white/80 py-1.5 border-b border-white/[0.04] last:border-0"
                  >
                    <span>{it}</span>
                    <Check className="h-3.5 w-3.5 shrink-0 text-white/30" strokeWidth={2} aria-hidden />
                    <span className="sr-only">unterstützt</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
