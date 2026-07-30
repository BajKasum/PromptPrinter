import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { PageHeader } from "@/components/marketing/page-header";
import { FAQ } from "@/components/marketing/faq";
import { FadeIn } from "@/components/motion/fade-in";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { KeyRound, Wallet, RefreshCw } from "lucide-react";
import { PRO_PRICE_LABEL } from "@/lib/pricing";

export const metadata = {
  title: "Preise",
  description: `Free läuft mit deinem eigenen KI-Key komplett gratis. Ohne eigenen Key gibt's Pro ab ${PRO_PRICE_LABEL} im Monat.`,
};

// Three worries people actually have on a pricing page, answered before they
// have to ask. Each gets its own Finn — this is the page where he's supposed
// to be everywhere.
//
// Re-modelled 2026-07-30: Free requires a BYOK key now, it's not an optional
// upgrade path anymore (plans.ts, pricing.ts). Card #1 states that plainly
// instead of "you're no longer bound to a limit" framing, which implied Free
// had one to begin with. Card #2 dropped its PLAN_LIMITS.free.chatMessages
// reference for the same reason — that number is 0 by design, quoting it
// would read as a broken free tier.
const REASSURANCES = [
  {
    Icon: KeyRound,
    mascot: "explaining" as const,
    title: "Free braucht deinen eigenen Key",
    body: "Hinterleg deinen Anthropic-, OpenAI- oder Gemini-Key in den Einstellungen, dann läuft die App für dich komplett gratis. Du zahlst direkt bei deinem Anbieter, was du wirklich verbrauchst, nichts an mich.",
  },
  {
    Icon: Wallet,
    mascot: "helping" as const,
    title: "Keine Kreditkarte zum Start",
    body: "Kein Abo, keine Zahlungsdaten, nur dein eigener Key. Und wenn du lieber keinen einrichten willst, ist Pro die Alternative.",
  },
  {
    Icon: RefreshCw,
    mascot: "curious" as const,
    title: "Monatlich, jederzeit kündbar",
    body: "Kein Jahresvertrag, keine Mindestlaufzeit. Wenn du eine Weile nichts baust, pausierst du einfach und kommst später zurück.",
  },
];

export default function PricingPage() {
  return (
    <main>
      <Navbar />

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

      <section className="container-x pb-20 md:pb-24">
        <PricingGrid withMascot />
      </section>

      {/* Reassurance row, each point with its own Finn. */}
      <section className="container-x pb-24 md:pb-32">
        <div className="grid gap-4 md:grid-cols-3">
          {REASSURANCES.map(({ Icon, mascot, title, body }, i) => (
            <FadeIn key={title} delay={i * 0.08}>
              <div className="card-surface flex h-full flex-col items-center p-6 text-center">
                <AnimatedMascot state={mascot} motion="bob" size={84} alt="" />
                <div className="mt-3 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-accent-text" strokeWidth={1.8} />
                  <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
                </div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-secondary">{body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <FAQ />
      <Footer />
    </main>
  );
}
