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
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="rounded-3xl border border-border bg-surface/40 p-8 md:p-14 text-center">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text mb-4">
            Deine Tools
          </div>
          <h2 className="text-balance text-[32px] md:text-[44px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
            Ich spreche die Sprache deiner Tools.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] md:text-[17px] text-foreground/55">
            Was ich dir gebe, ist genau so formatiert, wie dein Tool es erwartet —
            du kopierst es direkt rein, ohne vorher etwas umzuschreiben.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-2.5">
            {TOOLS.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-surface px-4 py-2 text-[13.5px] text-foreground/75"
              >
                {t}
              </span>
            ))}
          </div>

          {/* Trust before pricing — points to the real, verifiable outputs above,
              not invented testimonials or metrics. */}
          <p className="mx-auto mt-9 max-w-lg text-[13.5px] leading-[1.6] text-foreground/45">
            Kein Mockup: Der Produktplan, die Datenbank und die Sicherheits-Checkliste
            sind echte Ausgaben.{" "}
            <Link
              href="#example"
              className="text-accent-text underline-offset-4 hover:underline"
            >
              Sieh sie dir oben an.
            </Link>
          </p>
        </div>
      </FadeIn>
    </section>
  );
}
