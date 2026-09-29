import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, Minus, Sparkles } from "lucide-react";
import { FadeIn } from "@/shared/motion/fade-in";
import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { PlanBadge } from "@/shared/ui/plan-badge";
import { LemonCheckoutButton } from "@/shared/ui/lemon-checkout-button";
import { localizePlans, type MarketingPlan } from "@/shared/lib/pricing";
import { PLAN_LIMITS, toPlanKey } from "@/shared/lib/plans";
import { cn } from "@/shared/lib/utils";
import { fmt, rich } from "@/shared/i18n/format";
import type { Messages } from "@/shared/i18n/messages/de";
import { createClient } from "@/server/supabase/server";
import { getConfiguredProviders } from "@/server/byok";
import { getLocale, getT } from "@/server/i18n";

export async function generateMetadata() {
  return { title: (await getT()).meta.plans };
}

// Always the live plan, a just-upgraded account must not see "Pro holen".
export const dynamic = "force-dynamic";

// "Alle Tarife anzeigen" im Kontomenü (Wunsch 29.09.2026): Free und Pro wie
// auf der Preisseite, aber in der App. Anders als /pricing weiss diese Seite,
// wer schaut: der aktuelle Plan ist markiert, der Kauf läuft direkt über den
// Checkout mit Mail und Konto-ID (wie auf /billing), und wer schon Pro hat,
// bekommt keinen Kauf-Knopf für den eigenen Plan angeboten.
//
// Alle Zahlen kommen aus plans.ts/pricing.ts, denselben Werten, die /api/chat
// durchsetzt. Die Vergleichstabelle darf nichts versprechen, was dort nicht
// steht (Rechts-Audit 28.09.2026, "unbelegte Behauptungen"). Die Texte kommen
// aus dem Wörterbuch der App-Sprache (localizePlans, t.pages.plans).
export default async function PlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, configuredProviders, t, locale] = await Promise.all([
    supabase.from("profiles").select("plan, is_admin").eq("id", user.id).maybeSingle(),
    getConfiguredProviders(supabase, user.id),
    getT(),
    getLocale(),
  ]);
  const m = t.pages.plans;

  const planKey = toPlanKey(profile?.plan as string | null | undefined);
  const isAdmin = profile?.is_admin ?? false;
  const hasByok = configuredProviders.length > 0;
  const onPro = planKey !== "free";

  // Gleiche Bedingung wie auf /billing und /pricing: ohne Webhook-Secret
  // schaltet niemand automatisch frei, dann sagt der Text das auch.
  const activatesAutomatically = Boolean(process.env.LEMON_SQUEEZY_WEBHOOK_SECRET);

  const plans = localizePlans(t, locale);
  const free = plans.find((p) => p.name === "Free");
  const pro = plans.find((p) => p.name === "Pro");
  if (!free || !pro) return null;

  return (
    <div>
      <FadeIn>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
              {m.title}
            </h1>
            <p className="mt-1.5 max-w-xl text-[14px] text-secondary">{m.subtitle}</p>
          </div>
          <div className="pb-0.5">
            <PlanBadge plan={planKey} isAdmin={isAdmin} />
          </div>
        </div>
      </FadeIn>

      <div className="grid max-w-4xl gap-5 md:grid-cols-2">
        <FadeIn delay={0.04}>
          <PlanCard plan={free} current={!onPro && !isAdmin} m={m}>
            {isAdmin ? null : !onPro ? (
              <>
                <CurrentPlanChip label={m.current} />
                {!hasByok && (
                  <p className="mt-3 text-[12.5px] leading-relaxed text-secondary">
                    {m.needKey}{" "}
                    <Link
                      href="/settings#api-keys"
                      className="text-foreground underline underline-offset-2 hover:text-accent-text"
                    >
                      {m.addKey}
                    </Link>
                  </p>
                )}
              </>
            ) : (
              <p className="mt-6 text-[12.5px] leading-relaxed text-secondary">
                {rich(m.backToFree, {
                  billing: (
                    <Link
                      href="/billing"
                      className="text-foreground underline underline-offset-2 hover:text-accent-text"
                    >
                      {m.billingLink}
                    </Link>
                  ),
                })}
              </p>
            )}
          </PlanCard>
        </FadeIn>

        <FadeIn delay={0.1}>
          <PlanCard plan={pro} current={onPro && !isAdmin} m={m}>
            {isAdmin ? (
              <p className="mt-6 text-[12.5px] leading-relaxed text-secondary">{m.adminAll}</p>
            ) : onPro ? (
              <>
                <CurrentPlanChip label={m.current} />
                <Link
                  href="/billing"
                  className="mt-3 inline-flex text-[13px] font-medium text-accent-text underline underline-offset-2 hover:text-accent-text/80"
                >
                  {m.manage}
                </Link>
              </>
            ) : (
              <>
                <LemonCheckoutButton
                  email={user.email}
                  userId={user.id}
                  fallbackHref="/pricing"
                  className="mt-6 w-full"
                  successMessage={
                    activatesAutomatically ? t.pages.billing.thanksAuto : t.pages.billing.thanksManual
                  }
                >
                  {fmt(t.pages.billing.getPro, { price: pro.price, cadence: pro.cadence })}
                </LemonCheckoutButton>
                {pro.note && (
                  <p className="mt-2.5 text-[12px] leading-relaxed text-secondary">{pro.note}</p>
                )}
              </>
            )}
          </PlanCard>
        </FadeIn>
      </div>

      <FadeIn delay={0.16}>
        <ComparisonTable m={m} />
      </FadeIn>
    </div>
  );
}

type PlansCopy = Messages["pages"]["plans"];

function CurrentPlanChip({ label }: { label: string }) {
  return (
    <div className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border text-[13px] font-medium text-secondary">
      <Check className="h-4 w-4" strokeWidth={2.2} />
      {label}
    </div>
  );
}

/**
 * Eine Plan-Karte. Pro trägt dieselbe Hervorhebung wie auf /pricing (Akzent-
 * Rahmen, Licht von oben, "Finns Empfehlung"), Free bleibt die ruhige Karte:
 * die bezahlte Variante soll auf den ersten Blick die empfohlene sein, ohne
 * dass Free dadurch schlechter aussieht, als es ist.
 */
function PlanCard({
  plan,
  current,
  m,
  children,
}: {
  plan: MarketingPlan;
  current: boolean;
  m: PlansCopy;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={fmt(current ? m.cardLabelCurrent : m.cardLabel, { name: plan.name })}
      className={cn(
        "relative h-full rounded-2xl",
        plan.highlight
          ? "border border-accent/40 bg-surface p-7 shadow-elevated md:p-8"
          : "card-surface p-6 md:p-7"
      )}
    >
      {plan.highlight && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 rounded-t-2xl bg-[radial-gradient(ellipse_at_top,hsl(var(--accent)/0.22),transparent_75%)]"
          />
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <div className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.1em] text-accent-foreground">
              <Sparkles className="h-3 w-3" strokeWidth={2} />
              {m.recommended}
            </div>
          </div>
        </>
      )}
      <AnimatedMascot
        state={plan.mascot}
        motion={plan.highlight ? "cheer" : "bob"}
        size={56}
        className="mb-3"
        alt=""
      />
      <h2
        className={cn(
          "text-[17px] font-semibold",
          plan.highlight ? "text-accent-text" : "text-foreground"
        )}
      >
        {plan.name}
      </h2>
      <p className="mt-1.5 text-[13.5px] leading-[1.5] text-secondary">{plan.description}</p>
      <div className="mt-6 flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-[40px] font-semibold tracking-[-0.03em]",
            plan.highlight ? "text-accent-text" : "text-foreground"
          )}
        >
          {plan.price}
        </span>
        <span className="text-[13px] text-tertiary">/ {plan.cadence}</span>
      </div>
      {plan.badge && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2.5 py-1 text-[11.5px] font-medium text-accent-text">
          {plan.badge}
        </div>
      )}
      {children}
      <ul className="mt-7 space-y-2.5">
        {plan.features.map((f) => (
          <li
            key={f}
            className={cn(
              "flex items-start gap-2.5 text-[14px]",
              plan.highlight ? "font-medium text-foreground" : "text-foreground/75"
            )}
          >
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" strokeWidth={2.2} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Cell = string | boolean;

// Zeile für Zeile aus plans.ts/pricing.ts abgeleitet, keine zweite Wahrheit.
// PDF nur für Pro: prompts/page.tsx und results/page.tsx schalten es genau so.
function comparisonRows(m: PlansCopy): { label: string; free: Cell; pro: Cell }[] {
  const r = m.rows;
  return [
    { label: r.access, free: r.accessFree, pro: r.accessPro },
    {
      label: r.replies,
      free: r.repliesFree,
      pro: fmt(r.repliesPro, { count: PLAN_LIMITS.pro.chatMessages }),
    },
    {
      label: r.projects,
      free: fmt(r.projectsFree, { count: PLAN_LIMITS.free.projects }),
      pro: r.projectsPro,
    },
    // Die Analyse ist ein Modellaufruf wie eine Chat-Antwort (docs/plaene-und-
    // limits), auf Free also nur mit eigenem Key.
    { label: r.brain, free: r.brainFree, pro: true },
    { label: r.savePrompts, free: true, pro: true },
    { label: r.markdown, free: true, pro: true },
    { label: r.pdf, free: false, pro: true },
    { label: r.cancel, free: r.cancelFree, pro: r.cancelPro },
  ];
}

function ComparisonTable({ m }: { m: PlansCopy }) {
  return (
    <section className="mt-14 max-w-4xl">
      <h2 className="mb-5 text-[15px] font-semibold text-foreground">{m.compareTitle}</h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
          <caption className="sr-only">{m.compareCaption}</caption>
          <thead>
            <tr className="border-b border-border bg-surface">
              <th scope="col" className="w-[34%] px-4 py-3 font-medium text-secondary">
                <span className="sr-only">{m.feature}</span>
              </th>
              <th scope="col" className="w-[33%] px-4 py-3 font-semibold text-foreground">
                Free
              </th>
              <th
                scope="col"
                className="w-[33%] bg-accent-subtle px-4 py-3 font-semibold text-accent-text"
              >
                Pro
              </th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows(m).map((row) => (
              <tr key={row.label} className="border-b border-border last:border-b-0">
                <th scope="row" className="px-4 py-3 font-medium text-foreground">
                  {row.label}
                </th>
                <td className="px-4 py-3 text-secondary">
                  <CellValue value={row.free} m={m} />
                </td>
                <td className="bg-accent-subtle/40 px-4 py-3 text-foreground">
                  <CellValue value={row.pro} m={m} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CellValue({ value, m }: { value: Cell; m: PlansCopy }) {
  if (value === true) {
    return (
      <>
        <Check aria-hidden className="h-4 w-4 text-accent-text" strokeWidth={2.2} />
        <span className="sr-only">{m.included}</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus aria-hidden className="h-4 w-4 text-tertiary" strokeWidth={2} />
        <span className="sr-only">{m.notIncluded}</span>
      </>
    );
  }
  return <>{value}</>;
}
