import dynamic from "next/dynamic";
import { FinnAtmosphere } from "@/components/marketing/finn-atmosphere";
import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { ExampleOutput } from "@/components/marketing/example-output";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { Integrations } from "@/components/marketing/integrations";
import { PricingPreview } from "@/components/marketing/pricing-preview";
import { FAQ } from "@/components/marketing/faq";
import { FinalCTA } from "@/components/marketing/final-cta";
import { Footer } from "@/components/marketing/footer";

// Code-split: GSAP + DrawSVG/MotionPath (how-it-works.tsx's scroll-scrubbed
// spine) are a real payload that only this below-the-fold section needs.
// Splitting it out of the shared bundle keeps the landing page's first load
// light; SSR stays on (default) so the section's content is still in the
// initial HTML for SEO, only the animation JS loads on demand.
const HowItWorks = dynamic(() =>
  import("@/components/marketing/how-it-works").then((m) => m.HowItWorks)
);

export default function HomePage() {
  return (
    <main className="relative">
      <FinnAtmosphere />
      <Navbar />
      <Hero />
      <HowItWorks />
      <ExampleOutput />
      <ProductShowcase />
      <Integrations />
      <PricingPreview />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
