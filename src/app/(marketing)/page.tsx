import { FinnAtmosphere } from "@/features/marketing/components/finn-atmosphere";
import { Navbar } from "@/features/marketing/components/navbar";
import { Hero } from "@/features/marketing/components/hero";
import { HowItWorks } from "@/features/marketing/components/how-it-works";
import { ProductShowcase } from "@/features/marketing/components/product-showcase";
import { PricingBridge } from "@/features/marketing/components/pricing-bridge";
import { FAQ } from "@/features/marketing/components/faq";
import { FinalCTA } from "@/features/marketing/components/final-cta";
import { Footer } from "@/features/marketing/components/footer";
//
// The public site is two pages: this one and /pricing.
//
// "Wie es funktioniert" briefly had its own route (/features, 2026-07-29) on
// the theory that a section nobody can link to may as well be a page. In
// practice it split one argument across two places that told it differently:
// the landing page pitched Finn and then stopped, while /features re-introduced
// him with a second greeting and carried the actual explanation. A visitor who
// never clicked "Funktionen" — most of them — only ever saw the pitch.
//
// So the explanation is back inline, and the navbar's "Funktionen" is an anchor
// into it again (#funktionen on HowItWorks). Pricing stays separate on purpose:
// it's the one page people arrive at directly, link to, and come back to.
//
// The order is the argument, in the order the questions come up: Finn shows the
// flow (Hero), how it goes (HowItWorks), where you'd work (ProductShowcase),
// what it costs (PricingBridge), the usual doubts (FAQ), then the ask (FinalCTA).
//
// FeaturesGrid (the 6-card "was du bekommst" grid, features-grid.tsx) sat
// between HowItWorks and ProductShowcase until 2026-07-30 — removed again on
// request, it repeated ground HowItWorks and ProductShowcase already cover and
// read as exactly the generic SaaS feature-grid the brand principles below
// reject. Component deleted (unused, restorable from git history).
export default function HomePage() {
  return (
    <main className="relative">
      <FinnAtmosphere />
      <Navbar />
      <Hero />
      <HowItWorks />
      <ProductShowcase />
      <PricingBridge />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
