import Link from "next/link";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { FeaturesGrid } from "@/components/marketing/features-grid";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { FinnGreeting } from "@/components/marketing/finn-greeting";
import { FinalCTA } from "@/components/marketing/final-cta";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { PRO_PRICE_LABEL } from "@/lib/pricing";

export const metadata = {
  title: "Wie es funktioniert",
  description:
    "Ein KI-Chat, der nachfragt, bis deine Idee klar ist, und dir dann den fertigen, passenden Prompt für Claude, ChatGPT, Lovable, Cursor & Co. liefert.",
};

// The "Wie es funktioniert" page. This used to be a section buried halfway
// down the landing page, reachable only by scrolling; it's now its own
// destination behind the navbar's "Funktionen" link, and it opens with Finn
// introducing himself rather than with a mono eyebrow label.
export default function FeaturesPage() {
  return (
    <main>
      <Navbar />

      <FinnGreeting
        state="welcoming"
        greeting="Hallo, ich bin Finn. 👋"
        headline={
          <>
            Erzähl mir deine Idee. Ich mach{" "}
            <span className="gradient-text">einen fertigen Prompt draus.</span>
          </>
        }
        sub="Ein kurzes Gespräch, eine Rückfrage, und du hast den Prompt, den dein Bau-Tool wirklich versteht. Kein Fachchinesisch, keine Formulare."
      />

      <HowItWorks />
      <FeaturesGrid />

      {/* The natural next question after "how does it work" is "what does it
          cost". Pricing lives on its own page now, so this is the bridge. */}
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

      <FinalCTA />
      <Footer />
    </main>
  );
}
