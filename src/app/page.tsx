import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { Problem } from "@/components/marketing/problem";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ExampleOutput } from "@/components/marketing/example-output";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { Integrations } from "@/components/marketing/integrations";
import { PricingPreview } from "@/components/marketing/pricing-preview";
import { FAQ } from "@/components/marketing/faq";
import { FinalCTA } from "@/components/marketing/final-cta";
import { Footer } from "@/components/marketing/footer";

export default function HomePage() {
  return (
    <main className="relative">
      <Navbar />
      <Hero />
      <Problem />
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
