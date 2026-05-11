import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { FeaturesGrid } from "@/components/marketing/features-grid";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Integrations } from "@/components/marketing/integrations";
import { ExampleOutput } from "@/components/marketing/example-output";
import { FinalCTA } from "@/components/marketing/final-cta";
import { FadeIn } from "@/components/motion/fade-in";

export const metadata = {
  title: "Features",
  description:
    "Every artifact you need to ship — PRD, master prompt, frontend & backend prompts, schema, security, marketing, SEO, deployment.",
};

export default function FeaturesPage() {
  return (
    <main>
      <Navbar />
      <section className="container-x pt-32 md:pt-40 pb-12 text-center">
        <FadeIn>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 mb-6">
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-violet-300">
              Features
            </span>
          </div>
          <h1 className="text-balance text-[44px] md:text-[64px] leading-[1.05] tracking-[-0.04em] font-semibold text-white max-w-3xl mx-auto">
            Everything you need to <span className="gradient-text">go from idea to commit.</span>
          </h1>
          <p className="mt-6 text-[17px] text-white/55 max-w-2xl mx-auto">
            Each project is a complete build packet — generated, structured, exportable.
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
