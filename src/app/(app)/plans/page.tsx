import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, Minus, Sparkles } from "lucide-react";
import { FadeIn } from "@/shared/motion/fade-in";
import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { PlanBadge } from "@/shared/ui/plan-badge";
import { LemonCheckoutButton } from "@/shared/ui/lemon-checkout-button";
import { PLANS, type MarketingPlan } from "@/shared/lib/pricing";
import { PLAN_LIMITS, toPlanKey } from "@/shared/lib/plans";
import { cn } from "@/shared/lib/utils";
import { createClient } from "@/server/supabase/server";
import { getConfiguredProviders } from "@/server/byok";

export const metadata = { title: "Tarife" };

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
// steht (Rechts-Audit 28.09.2026, "unbelegte Behauptungen").
export default async function PlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, configuredProviders] = await Promise.all([
    supabase.from("profiles").select("plan, is_admin").eq("id", user.id).maybeSingle(),
    getConfiguredProviders(supabase, user.id),
  ]);

  const planKey = toPlanKey(profile?.plan as string | null | undefined);
  const isAdmin = profile?.is_admin ?? false;
  const hasByok = configuredProviders.length > 0;
  const onPro = planKey !== "free";

  // Gleiche Bedingung wie auf /billing und /pricing: ohne Webhook-Secret
  // schaltet niemand automatisch frei, dann sagt der Text das auch.
  const activatesAutomatically = Boolean(process.env.LEMON_SQUEEZY_WEBHOOK_SECRET);

  const free = PLANS.find((p) => p.name === "Free");
  const pro = PLANS.find((p) => p.name === "Pro");
  if (!free || !pro) return null;

  return (
    <div>
      <FadeIn>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
              Tarife
            </h1>
            <p className="mt-1.5 max-w-xl text-[14px] text-secondary">
              Free mit deinem eigenen KI-Key, oder Pro, wenn ich den Key für dich übernehme.
            </p>
          </div>
          <div className="pb-0.5">
            <PlanBadge plan={planKey} isAdmin={isAdmin} />
          </div>
        </div>
      </FadeIn>

      <div className="grid max-w-4xl gap-5 md:grid-cols-2">
        <FadeIn delay={0.04}>
          <PlanCard plan={free} current={!onPro && !isAdmin}>
            {isAdmin ? null : !onPro ? (
              <>
                <CurrentPlanChip />
                {!hasByok && (
                  <p className="mt-3 text-[12.5px] leading-relaxed text-secondary">
                    Zum Chatten brauchst du auf Free deinen eigenen Key.{" "}
                    <Link
                      href="/settings#api-keys"
                      className="text-foreground underline underline-offset-2 hover:text-accent-text"
                    >
                      Key hinterlegen
                    </Link>
                  </p>
                )}
              </>
            ) : (
              <p className="mt-6 text-[12.5px] leading-relaxed text-secondary">
                Zurück zu Free geht jederzeit: Abo unter{" "}
                <Link
                  href="/billing"
                  className="text-foreground underline underline-offset-2 hover:text-accent-text"
                >
                  Abrechnung
                </Link>{" "}
                kündigen, Pro bleibt bis zum Ende des bezahlten Monats.
              </p>
            )}
          </PlanCard>
        </FadeIn>

        <FadeIn delay={0.1}>
          <PlanCard plan={pro} current={onPro && !isAdmin}>
            {isAdmin ? (
              <p className="mt-6 text-[12.5px] leading-relaxed text-secondary">
                Als Admin ist bei dir alles freigeschaltet.
              </p>
            ) : onPro ? (
              <>
                <CurrentPlanChip />
                <Link
                  href="/billing"
                  className="mt-3 inline-flex text-[13px] font-medium text-accent-text underline underline-offset-2 hover:text-accent-text/80"
                >
                  Abo verwalten
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
                    activatesAutomatically
                      ? "Danke! Deine Zahlung ist angekommen. Lad die Seite einmal neu, dann ist Pro aktiv."
                      : "Danke! Deine Zahlung ist angekommen. Ich schalte dieses Konto auf Pro und melde mich, sobald es so weit ist."
                  }
                >
                  Pro holen, {pro.price} pro {pro.cadence}
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
        <ComparisonTable />
      </FadeIn>
    </div>
  );
}

function CurrentPlanChip() {
  return (
    <div className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border text-[13px] font-medium text-secondary">
      <Check className="h-4 w-4" strokeWidth={2.2} />
      Dein aktueller Plan
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
  children,
}: {
  plan: MarketingPlan;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={`Plan ${plan.name}${current ? ", dein aktueller Plan" : ""}`}
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
              Finns Empfehlung
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
const ROWS: { label: string; free: Cell; pro: Cell }[] = [
  {
    label: "KI-Zugang",
    free: "Mit deinem eigenen Key (Anthropic, OpenAI, Gemini)",
    pro: "Inklusive, kein eigener Key nötig",
  },
  {
    label: "Chat-Antworten",
    free: "Mit deinem Key ohne Monatslimit",
    pro: `${PLAN_LIMITS.pro.chatMessages} pro Monat inklusive, mit eigenem Key ohne Monatslimit`,
  },
  { label: "Projekte", free: `Bis zu ${PLAN_LIMITS.free.projects}`, pro: "Unbegrenzt" },
  // Die Analyse ist ein Modellaufruf wie eine Chat-Antwort (docs/plaene-und-
  // limits), auf Free also nur mit eigenem Key.
  { label: "Projekt-Gedächtnis", free: "Mit deinem Key", pro: true },
  { label: "Prompts speichern", free: true, pro: true },
  { label: "Markdown-Export", free: true, pro: true },
  { label: "PDF-Export", free: false, pro: true },
  { label: "Kündigung", free: "Nichts zu kündigen", pro: "Monatlich, 14 Tage Geld zurück" },
];

function ComparisonTable() {
  return (
    <section className="mt-14 max-w-4xl">
      <h2 className="mb-5 text-[15px] font-semibold text-foreground">Im Vergleich</h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
          <caption className="sr-only">Free und Pro im Vergleich</caption>
          <thead>
            <tr className="border-b border-border bg-surface">
              <th scope="col" className="w-[34%] px-4 py-3 font-medium text-secondary">
                <span className="sr-only">Funktion</span>
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
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-b-0">
                <th scope="row" className="px-4 py-3 font-medium text-foreground">
                  {row.label}
                </th>
                <td className="px-4 py-3 text-secondary">
                  <CellValue value={row.free} />
                </td>
                <td className="bg-accent-subtle/40 px-4 py-3 text-foreground">
                  <CellValue value={row.pro} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CellValue({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <>
        <Check aria-hidden className="h-4 w-4 text-accent-text" strokeWidth={2.2} />
        <span className="sr-only">Enthalten</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus aria-hidden className="h-4 w-4 text-tertiary" strokeWidth={2} />
        <span className="sr-only">Nicht enthalten</span>
      </>
    );
  }
  return <>{value}</>;
}
