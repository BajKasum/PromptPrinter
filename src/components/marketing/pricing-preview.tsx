import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { Floaters, type FloaterSpec } from "@/components/brand/floaters";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const PRICING_FLOATERS: FloaterSpec[] = [
  { kind: "star", top: "5%", left: "9%", size: 13, delay: 0.2, duration: 3.4 },
  { kind: "bubble", top: "14%", left: "90%", size: 18, delay: 0.8, duration: 4.6 },
  { kind: "star", top: "40%", left: "95%", size: 10, delay: 1.4, duration: 3.2 },
  { kind: "bubble", top: "60%", left: "3%", size: 16, delay: 0.5, duration: 4.3 },
  { kind: "star", top: "90%", left: "85%", size: 9, delay: 1.0, duration: 3.5 },
];

export const PLANS = [
  {
    name: "Free",
    price: "0 €",
    cadence: "für immer",
    description: "Zum Lernen und Bauen mit deinen eigenen API-Keys.",
    cta: "Kostenlos starten",
    href: "/signup",
    highlight: false,
    features: [
      "Eigene API-Keys (Claude, ChatGPT, Gemini)",
      "Für jede Ziel-KI",
      "Chats & Projekte",
      "Markdown-Export",
    ],
  },
  {
    name: "Pro",
    price: "7 €",
    cadence: "Monat",
    description: "Wenn du keine eigenen Keys einrichten willst oder mehr Spielraum brauchst.",
    // "Pro starten" versprach einen Kauf, den es nicht gibt: der Klick führte
    // auf eine gewöhnliche Registrierung, das Konto landete auf Free, und dass
    // Bezahlung noch gar nicht freigeschaltet ist, stand nur hinter dem Login
    // auf der Abrechnungsseite (QA-Befund U-2). Jetzt sagt der Button, was er
    // tut, und die Notiz darunter sagt, warum.
    cta: "Für Pro vormerken",
    href: "/signup?plan=pro",
    note: "Bezahlung ist noch nicht freigeschaltet. Du startest auf Free, ich melde mich, sobald Pro buchbar ist.",
    highlight: true,
    features: [
      "Alles aus Free",
      "Meine API inklusive, kein eigener Key nötig",
      "Höhere Limits, auch mit eigenem Key",
      "PDF- & Markdown-Export",
    ],
  },
];

export function PricingPreview() {
  return (
    <section id="preise" className="relative overflow-hidden scroll-mt-24 container-x pt-24 md:pt-32 pb-20 md:pb-24">
      <Floaters items={PRICING_FLOATERS} />

      <FadeIn className="relative z-10">
        <div className="mb-12 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-foreground">
              Fang kostenlos an. Zahl erst, wenn du mehr brauchst.
            </h2>
            <p className="mt-4 max-w-xl text-[16px] md:text-[17px] text-secondary">
              Kein Druck, keine Kreditkarte. Du wechselst erst, wenn du gemerkt
              hast, dass du das hier regelmäßig nutzt.
            </p>
          </div>
          {/* Finn helps you pick, most builders start free. */}
          <AnimatedMascot
            state="helping"
            motion="bob"
            size={140}
            className="hidden shrink-0 md:block"
            alt="Der Delfin hilft dir bei der Wahl des Plans"
          />
        </div>
      </FadeIn>
      <PricingGrid />
    </section>
  );
}

export function PricingGrid() {
  return (
    <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
      {PLANS.map((p, i) => (
        <FadeIn key={p.name} delay={i * 0.08}>
          <div
            className={cn(
              "relative h-full rounded-2xl transition-all",
              p.highlight
                ? "border border-border-strong bg-surface p-8 shadow-elevated"
                : "card-surface p-6 md:p-7"
            )}
          >
            {p.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.1em] text-accent-foreground">
                  Finns Empfehlung
                </div>
              </div>
            )}
            <h3 className="text-[17px] font-semibold text-foreground">{p.name}</h3>
            <p className="mt-1.5 text-[13.5px] leading-[1.5] text-secondary">
              {p.description}
            </p>
            <div className="mt-7 flex items-baseline gap-1.5">
              <span className="text-[44px] font-semibold tracking-[-0.03em] text-foreground">
                {p.price}
              </span>
              <span className="text-[13px] text-tertiary">/ {p.cadence}</span>
            </div>
            <Button
              asChild
              variant={p.highlight ? "primary" : "ghost"}
              className="w-full mt-6"
            >
              <Link href={p.href}>{p.cta}</Link>
            </Button>
            {p.note && (
              <p className="mt-2.5 text-[12px] leading-relaxed text-secondary">{p.note}</p>
            )}
            <ul className="mt-7 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[14px] text-foreground/75">
                  <Check className="h-4 w-4 mt-0.5 text-accent-text shrink-0" strokeWidth={2.2} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
      ))}
    </div>
  );
}
