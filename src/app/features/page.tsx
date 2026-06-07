import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { FeaturesGrid } from "@/components/marketing/features-grid";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Integrations } from "@/components/marketing/integrations";
import { ExampleOutput } from "@/components/marketing/example-output";
import { FinalCTA } from "@/components/marketing/final-cta";
import { FadeIn } from "@/components/motion/fade-in";

export const metadata = {
  title: "Funktionen",
  description:
    "Jedes Artefakt, das du zum Ausliefern brauchst — PRD, Master-Prompt, Frontend- & Backend-Prompts, Schema, Sicherheit, Marketing, SEO, Deployment.",
};

export default function FeaturesPage() {
  return (
    <main>
      <Navbar />
      <section className="container-x pt-32 md:pt-40 pb-12 text-center">
        <FadeIn>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 mb-6">
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text">
              Funktionen
            </span>
          </div>
          <h1 className="text-balance text-[44px] md:text-[64px] leading-[1.05] tracking-[-0.04em] font-semibold text-foreground max-w-3xl mx-auto">
            Alles, was du brauchst, um <span className="gradient-text">von der Idee zum Commit zu kommen.</span>
          </h1>
          <p className="mt-6 text-[17px] text-foreground/55 max-w-2xl mx-auto">
            Jedes Projekt ist ein komplettes Build-Packet — generiert, strukturiert, exportierbar.
          </p>
        </FadeIn>
      </section>
      <HowItWorks />
      <FeaturesGrid />
      <ExampleOutput />
      <Integrations />
      <FinalCTA />
      <Footer />
    </main>
  );
}
