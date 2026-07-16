import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { FeaturesGrid } from "@/components/marketing/features-grid";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { FinalCTA } from "@/components/marketing/final-cta";
import { FadeIn } from "@/components/motion/fade-in";

export const metadata = {
  title: "Funktionen",
  description:
    "Ein KI-Chat, der nachfragt, bis deine Idee klar ist, und dir dann den fertigen, passenden Prompt für Claude, ChatGPT, Lovable, Cursor & Co. liefert.",
};

export default function FeaturesPage() {
  return (
    <main>
      <Navbar />
      <section
        id="main-content"
        tabIndex={-1}
        className="container-x pt-32 md:pt-40 pb-12 text-center focus:outline-none"
      >
        <FadeIn>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 mb-6">
            <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-accent-text">
              Funktionen
            </span>
          </div>
          <h1 className="text-balance text-[44px] md:text-[64px] leading-[1.05] tracking-[-0.04em] font-semibold text-foreground max-w-3xl mx-auto">
            Von der rohen Idee <span className="gradient-text">zum fertigen Prompt.</span>
          </h1>
          <p className="mt-6 text-[17px] text-foreground/55 max-w-2xl mx-auto">
            Ein Gespräch, eine klärende Rückfrage, dein passender Prompt, zugeschnitten
            auf das Tool, mit dem du weiterbaust.
          </p>
        </FadeIn>
      </section>
      <HowItWorks />
      <FeaturesGrid />
      <FinalCTA />
      <Footer />
    </main>
  );
}
