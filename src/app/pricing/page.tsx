import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { PricingGrid } from "@/components/marketing/pricing-preview";
import { FAQ } from "@/components/marketing/faq";
import { FadeIn } from "@/components/motion/fade-in";

export const metadata = {
  title: "Preise",
  description: "Free-, Pro- und Team-Pläne. Keine Kreditkarte zum Start.",
};

export default function PricingPage() {
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
              Preise
            </span>
          </div>
          <h1 className="text-balance text-[44px] md:text-[64px] leading-[1.05] tracking-[-0.04em] font-semibold text-foreground max-w-3xl mx-auto">
            Einfache, <span className="gradient-text">ehrliche Preise.</span>
          </h1>
          <p className="mt-6 text-[17px] text-foreground/55 max-w-2xl mx-auto">
            Starte kostenlos. Upgrade, wenn du mehr Generierungen brauchst oder dein Team
            Workspaces teilen muss.
          </p>
        </FadeIn>
      </section>
      <section className="container-x pb-24">
        <PricingGrid />
      </section>
      <FAQ />
      <Footer />
    </main>
  );
}
