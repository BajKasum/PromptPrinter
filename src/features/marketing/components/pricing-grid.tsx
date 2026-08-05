import Link from "next/link";
import { FadeIn } from "@/shared/motion/fade-in";
import { Button } from "@/shared/ui/button";
import { ProCheckoutCta } from "@/features/marketing/components/pro-checkout-cta";
import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { Check } from "lucide-react";
import { PLANS } from "@/shared/lib/pricing";
import { cn } from "@/shared/lib/utils";

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
 *
 * Free and Pro are deliberately NOT styled as two equal-weight options (asked
 * for from a live screenshot): Free stays the plain, quiet card it already
 * was — nothing new added — while Pro gets pulled towards the accent blue
 * throughout (name, price, a soft top glow, the check icons, and the CTA
 * itself switching from the monochrome `primary` button to the `accent`
 * fill). It's the one card DESIGN.md's "Brand-Momente" carve-out is for:
 * babyblau fill is normally reserved off buttons, but a single recommended
 * plan is exactly the kind of moment that rule exists to allow, not a default
 * CTA colour applied everywhere.
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
                ? "border border-accent/40 bg-surface p-8 shadow-elevated"
                : "card-surface p-6 md:p-7"
            )}
          >
            {/* Soft light from above, Pro's own version of the ambient glow
                the rest of the marketing site uses for "Finn's World" moments
                (PageHeader, Hero). `rounded-t-2xl` matches the card's own
                corner radius so the rectangular gradient doesn't peek past
                the rounded top edge the way an unrounded overlay would. */}
            {p.highlight && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 rounded-t-2xl bg-[radial-gradient(ellipse_at_top,hsl(var(--accent)/0.22),transparent_75%)]"
              />
            )}
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
            <h3
              className={cn(
                "text-[17px] font-semibold",
                p.highlight ? "text-accent-text" : "text-foreground"
              )}
            >
              {p.name}
            </h3>
            <p className="mt-1.5 text-[13.5px] leading-[1.5] text-secondary">
              {p.description}
            </p>
            <div className="mt-7 flex items-baseline gap-1.5">
              <span
                className={cn(
                  "text-[44px] font-semibold tracking-[-0.03em]",
                  p.highlight ? "text-accent-text" : "text-foreground"
                )}
              >
                {p.price}
              </span>
              <span className="text-[13px] text-tertiary">/ {p.cadence}</span>
            </div>
            {p.badge && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2.5 py-1 text-[11.5px] font-medium text-accent-text">
                {p.badge}
              </div>
            )}
            {p.checkout ? (
              // Diese Seite ist öffentlich und weiss standardmässig nicht,
              // wer klickt — ProCheckoutCta prüft das selbst, clientseitig
              // (siehe dort für das Warum), und zeigt bis dahin denselben
              // Link auf `/signup?plan=pro`, den p.href ohnehin ist.
              <ProCheckoutCta plan={p} />
            ) : (
              <Button
                asChild
                variant={p.highlight ? "accent" : "ghost"}
                className="w-full mt-6"
              >
                <Link href={p.href}>{p.cta}</Link>
              </Button>
            )}
            {p.note && (
              <p className="mt-2.5 text-[12px] leading-relaxed text-secondary">{p.note}</p>
            )}
            <ul className="mt-7 space-y-2.5">
              {p.features.map((f) => (
                <li
                  key={f}
                  className={cn(
                    "flex items-start gap-2.5 text-[14px]",
                    p.highlight ? "font-medium text-foreground" : "text-foreground/75"
                  )}
                >
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
