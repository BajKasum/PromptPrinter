import { FinnAtmosphere } from "@/components/marketing/finn-atmosphere";
import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { FAQ } from "@/components/marketing/faq";
import { FinalCTA } from "@/components/marketing/final-cta";
import { Footer } from "@/components/marketing/footer";

// The landing page is the pitch, not the whole site. "Wie es funktioniert"
// (HowItWorks + FeaturesGrid) and the plans both used to live further down
// this page, reachable only by scrolling — they're their own pages now
// (/features, /pricing), linked from the navbar, so each one is a place you
// can actually send someone.
//
// What's left is the shortest honest path to a decision: Finn introduces
// himself and shows the flow (Hero), you see the real workspace
// (ProductShowcase), the usual doubts get answered (FAQ), then the ask.
export default function HomePage() {
  return (
    <main className="relative">
      <FinnAtmosphere />
      <Navbar />
      <Hero />
      <ProductShowcase />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
