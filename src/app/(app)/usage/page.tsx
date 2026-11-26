import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Activity, Database, Gauge, KeyRound } from "lucide-react";
import { FadeIn } from "@/shared/motion/fade-in";
import { AdminBadge } from "@/shared/ui/admin-badge";
import { UsageMeter } from "@/features/settings/components/usage-meter";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { FREE_TRIAL, requiresOwnKey, resolvePlan } from "@/shared/lib/plans";
import { getConfiguredProviders } from "@/server/byok";
import { getSessionUser } from "@/server/session";
import { freePromptsLeft } from "@/server/free-trial";
import { readDailyServerKeyUsage } from "@/server/security/rate-limit";
import { alertingConfigured } from "@/server/observability/alerting";
import { llmConfig, selfHostedEndpointActive } from "@/server/llm";
import { getLocale, getT } from "@/server/i18n";
import { loadActivationFunnel } from "@/server/activation-funnel";
import { ActivationFunnelCard } from "@/features/settings/components/activation-funnel";
import { fmt, plural, rich } from "@/shared/i18n/format";
import { orThrow } from "@/server/supabase/query";

export async function generateMetadata() {
  return { title: (await getT()).meta.usage };
}

// Immer der aktuelle Stand, nie ein zwischengespeicherter.
export const dynamic = "force-dynamic";

// "Nutzung" im Kontomenü: was ein Konto hat und was ihm bleibt. Es gibt keinen Plan und kein Monatskontingent,
// also stehen hier genau die Grenzen, die wirklich zählen: die Projekte (Grenze auch im Trigger der Datenbank),
// die Gratis-Prompts auf dem Server-Key (server/free-trial.ts) und ob ein eigener Key hinterlegt ist, der sie
// ablöst. Für Admins hängen die Betriebszahlen darunter. /admin, /billing und /plans leiten hierher um
// (next.config.ts).
export default async function UsagePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const [profileResult, projectsCountResult, configuredProviders] = await Promise.all([
    supabase.from("profiles").select("plan, is_admin").eq("id", user.id).maybeSingle(),
    // Eigentümer zusätzlich zur RLS (Defense in depth).
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    getConfiguredProviders(supabase, user.id),
  ]);
  const { data: profile } = orThrow(profileResult, "profiles");
  const { count: projectsCount } = orThrow(projectsCountResult, "projects");
  const { plan, isAdmin, limits } = resolvePlan(profile);
  const hasOwnKey = configuredProviders.length > 0;

  // Dieselbe Bedingung wie im Chat (server/session.ts, api/cli/me): im Einzelbetrieb läuft jedes Konto auf dem
  // Endpunkt des Betreibers ohne Gratis-Rahmen, sonst gilt er nur ohne eigenen Key und ohne Adminrechte.
  const selfHosted = selfHostedEndpointActive();
  const onFreeTrial = !selfHosted && requiresOwnKey(plan, isAdmin, hasOwnKey);
  // null heisst "gerade nicht zählbar" (kein Redis), nicht "aufgebraucht": das sagt die Seite auch so.
  const promptsLeft = onFreeTrial ? await freePromptsLeft(user.id) : null;

  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const m = t.pages.usage;
  const note = isAdmin
    ? m.noteAdmin
    : selfHosted
      ? fmt(m.noteSelfHosted, { projects: limits.projects })
      : fmt(m.note, { prompts: FREE_TRIAL.prompts, projects: limits.projects });
  // Ohne zählbaren Gratis-Rahmen steht statt eines Balkens der Grund (UsageMeter mit limit 0).
  const noFreePromptsReason = selfHosted
    ? m.freePromptsSelfHosted
    : isAdmin
      ? m.freePromptsAdmin
      : hasOwnKey
        ? m.freePromptsOwnKey
        : m.freePromptsUnknown;

  return (
    <div>
      <FadeIn>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
              {m.title}
            </h1>
            <p className="mt-1.5 text-[14px] text-secondary">{m.subtitle}</p>
          </div>
          {isAdmin && (
            <div className="pb-0.5">
              <AdminBadge />
            </div>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.06}>
        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-foreground">{m.accountTitle}</h2>
          <p className="mb-7 max-w-lg text-[13px] leading-relaxed text-secondary">{note}</p>
          <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
            <UsageMeter label={m.projects} used={projectsCount ?? 0} limit={limits.projects} />
            {promptsLeft === null ? (
              <UsageMeter label={m.freePrompts} used={0} limit={0} zeroLabel={noFreePromptsReason} />
            ) : (
              <div>
                <UsageMeter
                  label={m.freePrompts}
                  used={FREE_TRIAL.prompts - promptsLeft}
                  limit={FREE_TRIAL.prompts}
                />
                <p className="mt-2 text-[12.5px] leading-relaxed text-tertiary">
                  {promptsLeft > 0 ? plural(m.freePromptsLeft, promptsLeft, locale) : m.freePromptsUsedUp}
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-6">
            <div className="flex items-center gap-2.5 text-[13px]">
              <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
              <span className="font-medium text-foreground/80">{m.ownKey}</span>
              <span className="text-secondary">{hasOwnKey ? m.ownKeySet : m.ownKeyNone}</span>
            </div>
            <Link
              href="/settings#api-keys"
              className="touch-hit-y relative text-[12.5px] text-tertiary underline underline-offset-2 transition-colors hover:text-foreground"
            >
              {m.ownKeyLink}
            </Link>
          </div>
        </section>
      </FadeIn>

      {isAdmin && <OperationsSection />}
    </div>
  );
}

// The visible half of QA finding C-7, bis 29.09.2026 die eigene Seite
// /admin ("Betrieb"). Structured logs answer "what happened" after the fact;
// this section answers "is something draining my key right now", which is the
// question the anonymous-chat hole (S-1) went unanswered on for as long as it
// was open. Deliberately small: four numbers that would each have moved
// during that incident, not a dashboard product.
//
// Cross-user counts need the service-role client — RLS scopes the normal one
// to the caller, which is the whole point everywhere else. Safe here because
// this component only renders behind the page's is_admin check, and it is a
// server component: nothing of it reaches a non-admin's browser.
async function OperationsSection() {
  const usageMessages = (await getT()).pages.usage;
  const ops = usageMessages.ops;
  const locale = await getLocale();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString();

  const admin = createAdminClient();
  const [
    serverKey,
    usersTotalResult,
    messagesMonthResult,
    messagesTodayResult,
    funnel,
  ] =
    await Promise.all([
      readDailyServerKeyUsage(),
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("role", "assistant")
        .gte("created_at", monthStart),
      admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("role", "assistant")
        .gte("created_at", dayStart),
      loadActivationFunnel(admin, now),
    ]);
  const { count: usersTotal } = orThrow(usersTotalResult, "profiles");
  const { count: messagesMonth } = orThrow(messagesMonthResult, "messages");
  const { count: messagesToday } = orThrow(messagesTodayResult, "messages");

  // ~0.012 $ per turn at the worst case measured for glm-4.5-air (24k in,
  // 6144 out). A rough order of magnitude, not an invoice — the streaming path
  // never sees the provider's own token counts.
  const estimatedMonthCost = ((messagesMonth ?? 0) * 0.012).toFixed(2);
  const provider = llmConfig();

  return (
    <FadeIn delay={0.12}>
      <section className="mt-14 border-t border-border pt-10">
        <h2 className="text-[15px] font-semibold text-foreground">{ops.title}</h2>
        <p className="mb-6 mt-1.5 max-w-lg text-[13px] leading-relaxed text-secondary">
          {ops.hint}
        </p>

        <div className="card-surface mb-4 p-6">
          <h3 className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <Gauge className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
            {ops.serverKey}
          </h3>
          <p className="mb-5 text-[13px] leading-relaxed text-muted-foreground">
            {ops.serverKeyHint}
          </p>
          {serverKey ? (
            <UsageMeter label={ops.callsToday} used={serverKey.used} limit={serverKey.budget} />
          ) : (
            <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-3 text-[13px] text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
              <span>{ops.noUpstash}</span>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            Icon={Activity}
            label={ops.repliesToday}
            value={String(messagesToday ?? 0)}
            hint={ops.repliesTodayHint}
          />
          <StatCard
            Icon={Activity}
            label={ops.repliesMonth}
            value={String(messagesMonth ?? 0)}
            hint={fmt(ops.repliesMonthHint, { cost: estimatedMonthCost })}
          />
          <StatCard
            Icon={Database}
            label={ops.accounts}
            value={String(usersTotal ?? 0)}
            hint={
              provider
                ? fmt(ops.provider, { provider: provider.provider, model: provider.model })
                : ops.stub
            }
          />
        </div>

        {/* Aktivierung nach Anmeldewoche (#128): Zähler über die gespeicherten Daten des
            Dienstes, ohne Inhalte. Gehört zu "Betrieb" und damit hinter dieselbe Admin-Prüfung. */}
        <ActivationFunnelCard funnel={funnel} locale={locale} labels={usageMessages.funnel} />

        {/* Whether anyone would actually hear about an incident. This section
            is pull-based — it only helps someone who already suspects a
            problem and logs in to look. The webhook is the push half. */}
        {!alertingConfigured() && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-3 text-[13px] text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>{rich(ops.noWebhook, { name: <code>ALERT_WEBHOOK_URL</code> })}</span>
          </div>
        )}
        <p className="mt-6 text-[12.5px] leading-relaxed text-muted-foreground">
          {ops.costNote}
        </p>
      </section>
    </FadeIn>
  );
}

function StatCard({
  Icon,
  label,
  value,
  hint,
}: {
  Icon: typeof Activity;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="card-surface p-5">
      <div className="mb-2 flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
        {label}
      </div>
      <div className="text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-foreground">
        {value}
      </div>
      <div className="mt-1 text-[12px] text-muted-foreground">{hint}</div>
    </div>
  );
}
