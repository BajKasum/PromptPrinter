import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { Check } from "lucide-react";
import { PLANS } from "@/lib/pricing";
import { cn } from "@/lib/utils";

// Only the plan cards live here now. The surrounding "PricingPreview" section
// (headline + a Finn + floaters) was the landing page's pricing block; pricing
// is its own page since 2026-07-29 (/pricing), which brings its own greeting
// and its own Finns, so the wrapper had no caller left. Plan DATA moved to
// lib/pricing.ts, where the marketed numbers derive from the enforced ones in
// plans.ts instead of being a second, hand-kept copy.

/**
 * The two plan cards. `withMascot` gives each card its own Finn — used on the
 * dedicated /pricing page, where he's the point; left off in the landing
 * page's compact section, which already has one Finn in its header and would
 * otherwise have three dolphins competing in one viewport.
 */
export function PricingGrid({ withMascot = false }: { withMascot?: boolean }) {
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
            {withMascot && (
              <AnimatedMascot
                state={p.mascot}
                motion={p.highlight ? "cheer" : "bob"}
                size={72}
                className="mb-3"
                alt=""
              />
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
