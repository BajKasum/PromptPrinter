import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { PRO_PRICE_LABEL } from "@/lib/pricing";

// The bridge from "here's what it does" to "here's what it costs". It lived
// inline on /features until that page was folded back into the landing page
// (2026-07-30); it's a component now because page.tsx should read as a list of
// sections rather than carry markup of its own.
//
// This is the only place on the landing page that names a price. The plans
// themselves live on /pricing, the one other page the site still has, so the
// job here is just to answer the question the feature sections provoke, not to
// re-tell the whole plan comparison.
export function PricingBridge() {
  return (
    <section className="container-x pb-24 md:pb-32">
      <FadeIn>
        <div className="card-surface mx-auto flex max-w-3xl flex-col items-center gap-5 p-8 text-center md:p-10">
          <h2 className="text-balance text-[26px] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground md:text-[32px]">
            Und was kostet das?
          </h2>
          <p className="max-w-xl text-balance text-[15px] leading-relaxed text-secondary">
            Bring deinen eigenen KI-Key mit, dann ist die App komplett kostenlos für
            dich. Willst du dich um keinen Key kümmern, gibt&apos;s Pro ab{" "}
            {PRO_PRICE_LABEL} im Monat.
          </p>
          <Button asChild size="lg">
            <Link href="/pricing">Preise ansehen</Link>
          </Button>
        </div>
      </FadeIn>
    </section>
  );
}
