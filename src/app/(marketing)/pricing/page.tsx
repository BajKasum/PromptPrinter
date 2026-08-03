import { PricingGrid } from "@/features/marketing/components/pricing-grid";
import { PageHeader } from "@/features/marketing/components/page-header";
import { FAQ } from "@/features/marketing/components/faq";
import { PRO_PRICE_LABEL } from "@/shared/lib/pricing";

export const metadata = {
  title: "Preise",
  description: `Free läuft mit deinem eigenen KI-Key komplett gratis. Ohne eigenen Key gibt's Pro ab ${PRO_PRICE_LABEL} im Monat.`,
};

// A reassurance row (eigener Key / keine Kreditkarte / monatlich kündbar, each
// with its own Finn) used to sit between the plan grid and the FAQ — removed
// on request as unnecessary: the FAQ right below already answers the same
// three worries in more depth, so the row was saying the same thing twice
// before you'd even scrolled past it.
export default function PricingPage() {
  return (
    <>

      {/* Headline only. The greeting Finn and the subline that used to sit here
          are gone (see page-header.tsx): the difference between the two plans is
          exactly what the two cards underneath spell out, so saying it in prose
          first just delayed them. */}
      <PageHeader
        headline={
          <>
            Bring deinen eigenen Key mit.{" "}
            <span className="text-accent-text">Oder ich übernehme das für dich.</span>
          </>
        }
      />

      <section className="container-x pb-24 md:pb-32">
        <PricingGrid withMascot />
      </section>

      <FAQ />
    </>
  );
}
