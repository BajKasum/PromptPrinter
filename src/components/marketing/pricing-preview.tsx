import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const PLANS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "For curious builders trying things out.",
    cta: "Start free",
    href: "/signup",
    highlight: false,
    features: [
      "3 projects",
      "20 generations / month",
      "All output types",
      "Markdown export",
    ],
  },
  {
    name: "Pro",
    price: "$19",
    cadence: "per month",
    description: "For solo founders shipping fast.",
    cta: "Start Pro",
    href: "/signup?plan=pro",
    highlight: true,
    features: [
      "Unlimited projects",
      "500 generations / month",
      "PDF & Markdown export",
      "Claude 4.7 + GPT-4o",
      "Priority queue",
    ],
  },
  {
    name: "Team",
    price: "$49",
    cadence: "per seat / mo",
    description: "For squads with shared blueprints.",
    cta: "Start Team",
    href: "/signup?plan=team",
    highlight: false,
    features: [
      "Everything in Pro",
      "Shared workspace",
      "SSO + audit log",
      "API access",
      "Custom templates",
    ],
  },
];

export function PricingPreview() {
  return (
    <section className="container-x py-24 md:py-32">
      <FadeIn>
        <div className="max-w-2xl mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-blue-300/80 mb-4">
            Pricing
          </div>
          <h2 className="text-balance text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.03em] font-semibold text-white">
            Pay for outputs, not chatter.
          </h2>
        </div>
      </FadeIn>
      <PricingGrid />
    </section>
  );
}

export function PricingGrid() {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {PLANS.map((p, i) => (
        <FadeIn key={p.name} delay={i * 0.08}>
          <div
            className={cn(
              "relative h-full rounded-2xl p-7 transition-all",
              p.highlight
                ? "gradient-border bg-white/[0.04]"
                : "card-surface"
            )}
          >
            {p.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.1em] text-white shadow-glow-violet">
                  Most popular
                </div>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <h3 className="text-[17px] font-semibold text-white">{p.name}</h3>
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/45">
                {p.highlight ? "Recommended" : ""}
              </div>
            </div>
            <p className="mt-1.5 text-[13.5px] text-white/55">{p.description}</p>
            <div className="mt-7 flex items-baseline gap-1.5">
              <span className="text-[44px] font-semibold tracking-[-0.03em] text-white">
                {p.price}
              </span>
              <span className="text-[13px] text-white/45">/ {p.cadence}</span>
            </div>
            <Button
              asChild
              variant={p.highlight ? "primary" : "ghost"}
              className="w-full mt-6"
            >
              <Link href={p.href}>{p.cta}</Link>
            </Button>
            <ul className="mt-7 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[14px] text-white/75">
                  <Check className="h-4 w-4 mt-0.5 text-violet-300/90 shrink-0" strokeWidth={2.2} />
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
