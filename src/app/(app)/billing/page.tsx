import { redirect } from "next/navigation";
import { Check, Clock } from "lucide-react";
import { FadeIn } from "@/shared/motion/fade-in";
import { PlanBadge } from "@/shared/ui/plan-badge";
import { UsageMeter } from "@/features/settings/components/usage-meter";
import { PLANS } from "@/shared/lib/pricing";
import { createClient } from "@/server/supabase/server";
import { effectiveLimits, type PlanKey } from "@/shared/lib/plans";
import { getConfiguredProviders } from "@/server/byok";

export const metadata = { title: "Abrechnung" };

// Always reflect the latest plan + usage, never a cached snapshot.
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Start of the current month (UTC), the chat-message allowance is per-month.
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();

  const [
    { data: profile },
    { count: projectsCount },
    { count: monthlyChatMessages },
    configuredProviders,
  ] = await Promise.all([
    supabase.from("profiles").select("plan, is_admin").eq("id", user.id).maybeSingle(),
    // Owner filter is explicit on top of RLS (defense in depth).
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    // One row per turn (see api/chat/route.ts's own count for why role=assistant).
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "assistant")
      .gte("created_at", monthStart),
    getConfiguredProviders(supabase, user.id),
  ]);

  const rawPlan = (profile?.plan as string | undefined) ?? "free";
  const planKey: PlanKey = rawPlan === "pro" || rawPlan === "team" ? rawPlan : "free";
  const isAdmin = profile?.is_admin ?? false;
  const isFree = planKey === "free";
  const hasByok = configuredProviders.length > 0;
  const limits = effectiveLimits(planKey, isAdmin);
  // A BYOK key lifts the chat cap the same way admin lifts both, the project
  // cap still applies either way.
  const chatLimit = hasByok ? Infinity : limits.chatMessages;
  const apiAccessLabel = isAdmin || !isFree ? "Inklusive" : hasByok ? "Eigener Key" : "Kein Key hinterlegt";

  // Free-without-a-key needs its own branch, both of its numbers behave
  // differently from the generic "voll, nächsten Monat" copy below: chat is 0
  // by design (plans.ts) and never resets, adding a key or moving to Pro are
  // the only ways past it; the project cap (3, same as every plan's original
  // cap) was never monthly either, it's a standing total, freed only by
  // deleting one or upgrading. The plain "nächsten Monat" branch further down
  // still fits Pro/Team as-is: their project cap is Infinity, so the only bar
  // that can ever fill for them is chat, which genuinely does reset monthly.
  const usageNote = isAdmin
    ? "Admin-Konto, die Balken unten sind nur zur Orientierung, sie greifen für dich nicht."
    : hasByok
      ? "Mit deinem eigenen Key entfällt das Chat-Limit. Das Projekt-Limit bleibt bestehen."
      : isFree
        ? "Chat braucht auf Free deinen eigenen Key, das ist kein Monatslimit zum Abwarten. Ist das Projekt-Limit voll, hilft Löschen oder Pro."
        : "Ist ein Balken voll, geht's erst im nächsten Monat weiter.";

  const pro = PLANS.find((p) => p.name === "Pro");
  // features[0] is "Alles aus Free", a meta-line, not something new, the
  // upgrade panel only cares about what's actually different.
  const proDelta = pro?.features.slice(1) ?? [];

  return (
    <div>
      <FadeIn>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
              Abrechnung
            </h1>
            <p className="mt-1.5 text-[14px] text-secondary">
              Dein Plan und deine Nutzung im aktuellen Monat.
            </p>
          </div>
          <div className="flex items-center gap-2.5 pb-0.5">
            <PlanBadge plan={planKey} isAdmin={isAdmin} />
            <span className="text-[12.5px] text-tertiary">API-Zugang: {apiAccessLabel}</span>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.06}>
        <section className={isFree && !isAdmin ? "mb-12" : ""}>
          <h2 className="mb-1.5 text-[15px] font-semibold text-foreground">Nutzung diesen Monat</h2>
          <p className="mb-7 max-w-lg text-[13px] leading-relaxed text-secondary">{usageNote}</p>
          <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
            <UsageMeter label="Projekte" used={projectsCount ?? 0} limit={limits.projects} />
            <UsageMeter
              label="Chat-Nachrichten"
              used={monthlyChatMessages ?? 0}
              limit={chatLimit}
              zeroLabel="Ohne eigenen Key nicht verfügbar auf Free"
            />
          </div>
        </section>
      </FadeIn>

      {/* Only a Free, non-admin account has anything to gain here, a Pro/
          Team account seeing its own plan pitched back at itself would read
          as broken, not helpful. */}
      {isFree && !isAdmin && pro && (
        <FadeIn delay={0.12}>
          <section className="card-surface p-6 md:p-8">
            <div className="flex flex-col gap-7 md:flex-row md:items-start md:justify-between">
              <div className="max-w-sm">
                <h2 className="text-[17px] font-semibold text-foreground">Mehr Spielraum mit Pro</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">
                  {pro.description}
                </p>
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
            <div className="mt-6 flex items-center gap-2 border-t border-border pt-5 text-[12.5px] text-tertiary">
              <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
              Bezahlung ist noch nicht freigeschaltet, sobald es so weit ist, meld ich mich.
            </div>
          </section>
        </FadeIn>
      )}
    </div>
  );
}
