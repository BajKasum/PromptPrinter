import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";

// One friendly line + a single row of the tools people actually recognize —
// not a 16-item checklist. Finn "speaks their language".
const TOOLS = [
  "Claude",
  "ChatGPT",
  "Gemini",
  "Cursor",
  "Claude Code",
  "Lovable",
  "v0",
  "Figma",
  "Stitch",
  "Supabase",
  "Postgres",
  "Vercel",
];

export function Integrations() {
  return (
    <section className="container-x py-16 md:py-24">
      {/* A light horizontal band, not a centered capsule: compact line on the
          left, the tools people recognize filling the right. A calm breather
          between the workspace preview and pricing. */}
      <FadeIn>
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-14">
          <div className="md:max-w-sm md:shrink-0">
            <h2 className="text-balance text-[28px] md:text-[34px] leading-[1.15] tracking-[-0.03em] font-semibold text-foreground">
              Ich spreche die Sprache deiner Tools.
            </h2>
            <p className="mt-3 text-[15px] md:text-[16px] leading-[1.6] text-foreground/55">
              Was ich dir gebe, ist genau so formatiert, wie dein Tool es erwartet.
              Du kopierst es direkt rein, ohne vorher etwas umzuschreiben.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 md:flex-1">
            {TOOLS.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-[13px] text-foreground/75"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Trust before pricing — points to the real, verifiable outputs above,
          not invented testimonials or metrics. */}
      <FadeIn delay={0.1}>
        <p className="mt-8 max-w-lg text-[13.5px] leading-[1.6] text-foreground/45">
          Kein Mockup: Der Produktplan, die Datenbank und die Sicherheits-Checkliste
          sind echte Ausgaben.{" "}
          <Link
            href="#example"
            className="text-accent-text underline-offset-4 hover:underline"
          >
            Sieh sie dir oben an.
          </Link>
        </p>
      </FadeIn>
    </section>
  );
}
