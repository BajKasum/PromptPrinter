import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { FinnGreeting } from "@/components/marketing/finn-greeting";
import { FAQ } from "@/components/marketing/faq";
import { FadeIn } from "@/components/motion/fade-in";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { KeyRound, Wallet, RefreshCw } from "lucide-react";
import { PLAN_LIMITS } from "@/lib/plans";
import { PRO_PRICE_EUR } from "@/lib/pricing";

export const metadata = {
  title: "Preise",
  description: `Kostenlos starten, mit eigenem KI-Key dauerhaft gratis. Pro ab ${PRO_PRICE_EUR} € im Monat.`,
};

// Three worries people actually have on a pricing page, answered before they
// have to ask. Each gets its own Finn — this is the page where he's supposed
// to be everywhere.
const REASSURANCES = [
  {
    Icon: KeyRound,
    mascot: "explaining" as const,
    title: "Mit eigenem Key gratis",
    body: `Hinterleg deinen Anthropic-, OpenAI- oder Gemini-Key, und du bist nicht mehr an ein Monatslimit gebunden. Du zahlst dann direkt beim Anbieter, was du wirklich verbrauchst.`,
  },
  {
    Icon: Wallet,
    mascot: "helping" as const,
    title: "Keine Kreditkarte zum Start",
    body: `Free heisst wirklich Free: ${PLAN_LIMITS.free.chatMessages} fertige Prompts pro Monat mit meiner KI, ohne dass du irgendwo Zahlungsdaten hinterlegst.`,
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

      <FinnGreeting
        state="helping"
        greeting="Ich helf dir, den passenden Plan zu finden."
        headline={
          <>
            Fang kostenlos an.{" "}
            <span className="text-accent-text">Zahl erst, wenn du mehr brauchst.</span>
          </>
        }
        sub="Zwei Pläne, keine versteckten Kosten. Und wenn du deinen eigenen KI-Key mitbringst, bleibt es dauerhaft gratis."
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
