import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check, ExternalLink } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { PLANS } from "@/components/marketing/pricing-preview";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { PLAN_LIMITS, type PlanKey } from "@/lib/plans";

export const metadata = { title: "Abrechnung" };

// Always reflect the latest plan + usage, never a cached snapshot.
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Start of the current month (UTC) — generations are a per-month allowance.
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();

  const [{ data: profile }, { count: projectsCount }, { count: monthlyGenerations }] =
    await Promise.all([
      supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase
        .from("generations")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthStart),
    ]);

  const rawPlan = (profile?.plan as string | undefined) ?? "free";
  const planKey: PlanKey = rawPlan === "pro" || rawPlan === "team" ? rawPlan : "free";
  const currentPlan = planKey.charAt(0).toUpperCase() + planKey.slice(1);
  const limits = PLAN_LIMITS[planKey];
  const projectsUsed = projectsCount ?? 0;
  const generationsUsed = monthlyGenerations ?? 0;
  const renewsOn = null;

  const fmtUsage = (used: number, limit: number) =>
    limit === Infinity ? String(used) : `${used} / ${limit}`;

  return (
    <div className="max-w-[1100px]">
      <FadeIn>
        <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
          Abrechnung
        </h1>
        <p className="mt-1 text-[14px] text-foreground/55 mb-8">
          Verwalte dein Abo und deine Nutzung.
        </p>
      </FadeIn>

      <FadeIn>
        <div className="card-surface mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-foreground/45 mb-1.5">
                Aktueller Plan
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-[24px] font-semibold text-foreground">{currentPlan}</span>
                {renewsOn && (
                  <span className="text-[13px] text-foreground/55">Verlängert {renewsOn}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[9px] font-mono uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full border border-border bg-surface text-foreground/45">
                Bald
              </span>
              <Button variant="ghost" disabled>
                In Stripe verwalten
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 pt-6 border-t border-border">
            <Stat label="Projekte" value={fmtUsage(projectsUsed, limits.projects)} />
            <Stat
              label="Generierungen (Monat)"
              value={fmtUsage(generationsUsed, limits.generations)}
            />
            <Stat label="API-Zugang" value="—" />
            <Stat label="Plätze" value="1" />
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="mb-4 flex items-center gap-2.5">
          <h2 className="text-[18px] font-semibold text-foreground">Plan wechseln</h2>
          <span className="text-[9px] font-mono uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full border border-border bg-surface text-foreground/45">
            Bald
          </span>
        </div>
      </FadeIn>

      <div className="grid md:grid-cols-3 gap-3">
        {PLANS.map((p, i) => (
          <FadeIn key={p.name} delay={0.1 + i * 0.05}>
            <div
              className={cn(
                "rounded-2xl p-6 h-full",
                p.highlight ? "gradient-border bg-surface" : "card-surface"
              )}
            >
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-[16px] font-semibold text-foreground">{p.name}</h3>
                {p.name === currentPlan && (
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-success border border-success/30 bg-success/10 px-2 py-0.5 rounded-full">
                    Aktiv
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5 mb-5">
                <span className="text-[28px] font-semibold tracking-[-0.02em] text-foreground">
                  {p.price}
                </span>
                <span className="text-[12px] text-foreground/45">/ {p.cadence}</span>
              </div>
              <ul className="space-y-1.5 mb-5">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12.5px] text-foreground/70">
                    <Check className="h-3.5 w-3.5 mt-0.5 text-accent-text/90 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={p.name === currentPlan ? "ghost" : p.highlight ? "primary" : "ghost"}
                className="w-full"
                disabled
              >
                {p.name === currentPlan ? "Aktuell" : `Zu ${p.name} wechseln`}
              </Button>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/45 mb-1">
        {label}
      </div>
      <div className="text-[15px] font-medium text-foreground">{value}</div>
    </div>
  );
}
