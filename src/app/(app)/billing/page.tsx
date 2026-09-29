import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, Clock } from "lucide-react";
import { FadeIn } from "@/shared/motion/fade-in";
import { PlanBadge } from "@/shared/ui/plan-badge";
import { LemonCheckoutButton } from "@/shared/ui/lemon-checkout-button";
import { localizePlans } from "@/shared/lib/pricing";
import { formatDate } from "@/shared/lib/utils";
import { createClient } from "@/server/supabase/server";
import type { PlanKey } from "@/shared/lib/plans";
import { getConfiguredProviders } from "@/server/byok";
import { getLocale, getT } from "@/server/i18n";
import { fmt, rich } from "@/shared/i18n/format";
import { LOCALE_TAGS } from "@/shared/i18n/locales";

export async function generateMetadata() {
  return { title: (await getT()).meta.billing };
}

// Lemon Squeezys Abo-Zustände stehen im Wörterbuch (t.pages.billing.status).
// Unvollständig zu sein ist dort eingeplant: kommt ein neuer Zustand dazu,
// zeigt die Seite ihn im Original an, statt ihn zu verschweigen. Die
// Zugangsentscheidung hängt ohnehin nicht an dieser Tabelle, sondern an
// server/billing/lemonsqueezy.ts.

// Always reflect the latest plan, never a cached snapshot.
export const dynamic = "force-dynamic";

// Seit 29.09.2026 nur noch Plan und Abo. Der Abschnitt "Nutzung diesen Monat"
// steht jetzt auf /usage ("Nutzung" im Kontomenü), zusammen mit den
// Betriebszahlen für Admins; hier zeigt nur noch ein Link dorthin.
export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, configuredProviders, t, locale] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "plan, is_admin, subscription_status, subscription_renews_at, subscription_ends_at, subscription_portal_url"
      )
      .eq("id", user.id)
      .maybeSingle(),
    getConfiguredProviders(supabase, user.id),
    getT(),
    getLocale(),
  ]);
  const statusLabels: Record<string, string> = t.pages.billing.status;
  const intlTag = LOCALE_TAGS[locale].intl;

  const rawPlan = (profile?.plan as string | undefined) ?? "free";
  const planKey: PlanKey = rawPlan === "pro" || rawPlan === "team" ? rawPlan : "free";
  const isAdmin = profile?.is_admin ?? false;
  const isFree = planKey === "free";
  const hasByok = configuredProviders.length > 0;
  const apiAccessLabel =
    isAdmin || !isFree
      ? t.pages.billing.apiIncluded
      : hasByok
        ? t.pages.billing.apiOwnKey
        : t.pages.billing.apiNoKey;

  // Was der Webhook zuletzt gemeldet hat. Nur lesbar, geschrieben wird
  // ausschliesslich serverseitig (Migration 0039 vergibt kein UPDATE-Grant).
  const subscriptionStatus = (profile?.subscription_status as string | null) ?? null;
  const renewsAt = (profile?.subscription_renews_at as string | null) ?? null;
  const endsAt = (profile?.subscription_ends_at as string | null) ?? null;
  const portalUrl = (profile?.subscription_portal_url as string | null) ?? null;
  const isCancelled = subscriptionStatus === "cancelled";

  // Ohne Webhook-Secret gibt es niemanden, der eine Zahlung entgegennimmt —
  // dann ist die Freischaltung Handarbeit, und die Seite muss das sagen statt
  // etwas zu versprechen, das kein Prozess einlöst. Serverseitig gelesen, der
  // Wert erreicht den Browser nie.
  const activatesAutomatically = Boolean(process.env.LEMON_SQUEEZY_WEBHOOK_SECRET);

  const pro = localizePlans(t, locale).find((p) => p.name === "Pro");
  // features[0] is "Alles aus Free", a meta-line, not something new, the
  // upgrade panel only cares about what's actually different.
  const proDelta = pro?.features.slice(1) ?? [];

  return (
    <div>
      <FadeIn>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
              {t.pages.billing.title}
            </h1>
            <p className="mt-1.5 text-[14px] text-secondary">
              {rich(t.pages.billing.subtitle, {
                usage: (
                  <Link
                    href="/usage"
                    className="text-foreground underline underline-offset-2 transition-colors hover:text-accent-text"
                  >
                    {t.pages.billing.usageLink}
                  </Link>
                ),
              })}
            </p>
          </div>
          <div className="flex items-center gap-2.5 pb-0.5">
            <PlanBadge plan={planKey} isAdmin={isAdmin} />
            <span className="text-[12.5px] text-tertiary">
              {fmt(t.pages.billing.apiAccess, { label: apiAccessLabel })}
            </span>
          </div>
        </div>
      </FadeIn>

      {/* Der Zustand, den der Webhook zuletzt gemeldet hat. Nur wo es einen
          gibt: ein Konto ohne Abo hat hier nichts zu lesen, und ein leerer
          Kasten "Abo: —" wäre schlechter als keiner. */}
      {subscriptionStatus && (
        <FadeIn delay={0.06}>
          <section className="mb-6 card-surface p-6 md:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <h2 className="text-[17px] font-semibold text-foreground">
                {t.pages.billing.subscription}
              </h2>
              <span className="text-[13px] text-secondary">
                {statusLabels[subscriptionStatus] ?? subscriptionStatus}
              </span>
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-secondary">
              {isCancelled && endsAt
                ? fmt(t.pages.billing.cancelledUntil, {
                    date: formatDate(endsAt, undefined, intlTag),
                  })
                : renewsAt
                  ? fmt(t.pages.billing.renewsOn, { date: formatDate(renewsAt, undefined, intlTag) })
                  : t.pages.billing.manageHint}
            </p>
            {/* M-2 (Audit 06.09.2026): vorher stand hier, egal was oben
                stand, nichts, worüber ein laufendes Abo tatsächlich
                kündbar war — der Hinweistext im dritten Fall (kein
                renewsAt) beschrieb einen Weg, den es sonst nirgends gab.
                Lemon Squeezys eigene Kundenportal-Adresse kommt jetzt mit
                jedem Abo-Ereignis mit (Migration 0041). */}
            {portalUrl && (
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center text-[13px] font-medium text-accent-text underline underline-offset-2 hover:text-accent-text/80"
              >
                {t.pages.billing.manage}
              </a>
            )}
          </section>
        </FadeIn>
      )}

      {/* Only a Free, non-admin account has anything to gain here, a Pro/
          Team account seeing its own plan pitched back at itself would read
          as broken, not helpful. */}
      {isFree && !isAdmin && pro && (
        <FadeIn delay={0.06}>
          <section className="card-surface p-6 md:p-8">
            <div className="flex flex-col gap-7 md:flex-row md:items-start md:justify-between">
              <div className="max-w-sm">
                <h2 className="text-[17px] font-semibold text-foreground">
                  {t.pages.billing.upsellTitle}
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">
                  {pro.description}
                </p>
                <Link
                  href="/plans"
                  className="mt-2 inline-flex text-[12.5px] text-tertiary underline underline-offset-2 transition-colors hover:text-foreground"
                >
                  {t.pages.billing.compare}
                </Link>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-[26px] font-semibold tracking-[-0.02em] text-foreground">
                    {pro.price}
                  </span>
                  <span className="text-[12.5px] text-tertiary">/ {pro.cadence}</span>
                </div>
              </div>
              <ul className="space-y-2.5 md:min-w-[260px]">
                {proDelta.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-foreground/80">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" strokeWidth={2.2} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6 border-t border-border pt-5">
              {/* Der einzige Ort im Produkt, an dem Mail UND Konto-ID bekannt
                  sind — beide reisen mit der Bestellung mit, damit eine
                  eingegangene Zahlung ohne Rückfrage dem richtigen Konto
                  zugeordnet werden kann. */}
              <LemonCheckoutButton
                email={user.email}
                userId={user.id}
                fallbackHref="/pricing"
                className="w-full sm:w-auto"
                // M-5 (Audit 06.09.2026): stand vorher immer auf "ich schalte
                // von Hand frei", direkt ueber dem Hinweis zwei Zeilen weiter
                // unten, der bei gesetztem Webhook-Secret das Gegenteil sagt
                // ("schaltet sich von selbst frei") — der Kaeufer las beide
                // Saetze gleichzeitig im selben Kasten. Beide haengen jetzt
                // an derselben activatesAutomatically-Bedingung.
                successMessage={
                  activatesAutomatically ? t.pages.billing.thanksAuto : t.pages.billing.thanksManual
                }
              >
                {fmt(t.pages.billing.getPro, { price: pro.price, cadence: pro.cadence })}
              </LemonCheckoutButton>
              <p className="mt-3.5 flex items-start gap-2 text-[12.5px] leading-relaxed text-tertiary">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                <span>
                  {activatesAutomatically
                    ? t.pages.billing.activatesAuto
                    : t.pages.billing.activatesManual}
                </span>
              </p>
            </div>
          </section>
        </FadeIn>
      )}
    </div>
  );
}
