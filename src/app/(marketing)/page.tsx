import { FinnAtmosphere } from "@/features/marketing/components/finn-atmosphere";
import { Hero } from "@/features/marketing/components/hero";
import { HowItWorks } from "@/features/marketing/components/how-it-works";
import { ProductShowcase } from "@/features/marketing/components/product-showcase";
import { FinalCTA } from "@/features/marketing/components/final-cta";
import { JsonLd } from "@/shared/ui/json-ld";
import { softwareApplicationJsonLd } from "@/features/marketing/lib/site-schema";
import { intro as howItWorksIntro, steps, title as howItWorksTitle } from "@/features/marketing/lib/how-it-works-data";
//
// Die Startseite erklärt das Produkt in einem Zug, "Funktionen" in der Navbar ist ein Anker darauf (#funktionen an
// HowItWorks), keine eigene Seite: eine Erklärung, an einer Stelle. Was es kostet (nichts) und wie man es selbst
// betreibt, steht auf /open-source, nicht hier.
//
// Die Reihenfolge ist das Argument, in der Reihenfolge, in der die Fragen kommen: Finn zeigt den Ablauf (Hero),
// wie er geht (HowItWorks), wo man arbeitet (ProductShowcase), dann die Einladung (FinalCTA). Kein Feature-Grid,
// keine Preis- oder Fragen-Sektion: sie wiederholten, was die Abschnitte schon sagen (CLAUDE.md, Brand-Prinzipien).
//
// HowTo-Markup: dieselben drei Schritte, die HowItWorks tatsächlich rendert
// (steps aus how-it-works.tsx), für Answer Engines, die eine "wie
// funktioniert X"-Frage direkt als Schrittliste beantworten wollen, statt
// erst die ganze Seite zusammenzufassen.
const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: howItWorksTitle,
  description: howItWorksIntro,
  step: steps.map((s) => ({
    "@type": "HowToStep",
    name: s.title,
    text: s.body,
  })),
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={softwareApplicationJsonLd()} />
      <JsonLd data={howToJsonLd} />
      <FinnAtmosphere />
      <Hero />
      <HowItWorks />
      <ProductShowcase />
      <FinalCTA />
    </>
  );
}
