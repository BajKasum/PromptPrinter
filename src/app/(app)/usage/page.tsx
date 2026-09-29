import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Activity, Database, Gauge } from "lucide-react";
import { FadeIn } from "@/shared/motion/fade-in";
import { PlanBadge } from "@/shared/ui/plan-badge";
import { UsageMeter } from "@/features/settings/components/usage-meter";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { effectiveLimits, type PlanKey } from "@/shared/lib/plans";
import { getConfiguredProviders } from "@/server/byok";
import {
  chatQuotaKey,
  getMonthlyQuotaUsage,
  readDailyServerKeyUsage,
} from "@/server/security/rate-limit";
import { alertingConfigured } from "@/server/observability/alerting";
import { llmConfig } from "@/server/llm";

export const metadata = { title: "Nutzung" };

// Always the live counters, never a cached snapshot.
export const dynamic = "force-dynamic";

// "Nutzung" im Kontomenü (Entscheid 29.09.2026). Vorher gab es zwei Orte mit
// halbem Inhalt: das eigene Kontingent stand als Abschnitt auf /billing, und
// "Betrieb" (/admin) zeigte die serverweiten Zahlen nur für Admins — normale
// Nutzer hatten im Menü gar keinen Eintrag dafür. Jetzt eine Seite für alle,
// die Betriebszahlen hängen darunter und erscheinen nur für is_admin.
// /admin leitet hierher um (next.config.ts), damit alte Lesezeichen weiter
// funktionieren.
export default async function UsagePage() {
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
    { count: monthlyChatMessagesFromDb },
    configuredProviders,
    redisChatUsage,
  ] = await Promise.all([
    supabase.from("profiles").select("plan, is_admin").eq("id", user.id).maybeSingle(),
    // Owner filter is explicit on top of RLS (defense in depth).
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    // One row per turn (see api/chat/route.ts's own count for why role=assistant).
    // Fallback only (see redisChatUsage below): a *deletable* balance, not the
    // *monotonic* one /api/chat actually enforces.
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "assistant")
      .gte("created_at", monthStart),
    getConfiguredProviders(supabase, user.id),
    // M-3 (Audit 06.09.2026): the DB count above drops when old chats are
    // deleted, the Redis counter that actually gates /api/chat never does.
    // Read the same counter enforcement reads from, fall back to the DB count
    // when Redis isn't configured (dev/self-hosting, where enforcement itself
    // falls back to that same DB count, see reserveMonthlyQuota).
    getMonthlyQuotaUsage(chatQuotaKey(user.id)),
  ]);
  const monthlyChatMessages = redisChatUsage ?? monthlyChatMessagesFromDb;

  const rawPlan = (profile?.plan as string | undefined) ?? "free";
  const planKey: PlanKey = rawPlan === "pro" || rawPlan === "team" ? rawPlan : "free";
  const isAdmin = profile?.is_admin ?? false;
  const isFree = planKey === "free";
  const hasByok = configuredProviders.length > 0;
  const limits = effectiveLimits(planKey, isAdmin);
  // A BYOK key lifts the chat cap the same way admin lifts both, the project
  // cap still applies either way.
  const chatLimit = hasByok ? Infinity : limits.chatMessages;

  // Free-without-a-key needs its own branch, both of its numbers behave
  // differently from the generic "voll, nächsten Monat" copy below: chat is 0
  // by design (plans.ts) and never resets, adding a key or moving to Pro are
  // the only ways past it; the project cap was never monthly either, it's a
  // standing total, freed only by deleting one or upgrading. The plain
  // "nächsten Monat" branch still fits Pro/Team as-is: their project cap is
  // Infinity, so the only bar that can ever fill for them is chat, which
  // genuinely does reset monthly.
  const usageNote = isAdmin
    ? "Admin-Konto, die Balken unten sind nur zur Orientierung, sie greifen für dich nicht."
    : hasByok
      ? "Mit deinem eigenen Key entfällt das Chat-Limit. Das Projekt-Limit bleibt bestehen."
      : isFree
        ? "Chat braucht auf Free deinen eigenen Key, das ist kein Monatslimit zum Abwarten. Ist das Projekt-Limit voll, hilft Löschen oder Pro."
        : "Ist ein Balken voll, geht's erst im nächsten Monat weiter.";

  return (
    <div>
      <FadeIn>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
              Nutzung
            </h1>
            <p className="mt-1.5 text-[14px] text-secondary">
              Was du im aktuellen Monat verbraucht hast.
            </p>
          </div>
          <div className="flex items-center gap-2.5 pb-0.5">
            <PlanBadge plan={planKey} isAdmin={isAdmin} />
            <Link
              href="/billing"
              className="text-[12.5px] text-tertiary underline underline-offset-2 transition-colors hover:text-foreground"
            >
              Plan und Abo
            </Link>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.06}>
        <section>
          <h2 className="mb-1.5 text-[15px] font-semibold text-foreground">Diesen Monat</h2>
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
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString();

  const admin = createAdminClient();
  const [serverKey, { count: usersTotal }, { count: messagesMonth }, { count: messagesToday }] =
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
    ]);

  // ~0.012 $ per turn at the worst case measured for glm-4.5-air (24k in,
  // 6144 out). A rough order of magnitude, not an invoice — the streaming path
  // never sees the provider's own token counts.
  const estimatedMonthCost = ((messagesMonth ?? 0) * 0.012).toFixed(2);
  const provider = llmConfig();

  return (
    <FadeIn delay={0.12}>
      <section className="mt-14 border-t border-border pt-10">
        <h2 className="text-[15px] font-semibold text-foreground">Betrieb</h2>
        <p className="mb-6 mt-1.5 max-w-lg text-[13px] leading-relaxed text-secondary">
          Nur für Admins sichtbar. Die Zahlen, an denen ein Kostenausreisser zuerst sichtbar
          wird, über alle Nutzer.
        </p>

        <div className="card-surface mb-4 p-6">
          <h3 className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <Gauge className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
            Server-Key heute
          </h3>
          <p className="mb-5 text-[13px] leading-relaxed text-muted-foreground">
            Modell-Aufrufe auf dem eigenen Key, global über alle Nutzer. Greift die
            Bremse, laufen BYOK-Nutzer weiter.
          </p>
          {serverKey ? (
            <UsageMeter label="Aufrufe heute" used={serverKey.used} limit={serverKey.budget} />
          ) : (
            <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-3 text-[13px] text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
              <span>
                Ohne Upstash gibt es keinen Zähler und damit keine Tagesbremse. In
                Produktion ist Upstash Pflicht, sonst antworten ohnehin alle API-Routen
                mit 429.
              </span>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            Icon={Activity}
            label="Antworten heute"
            value={String(messagesToday ?? 0)}
            hint="Alle Nutzer, seit 00:00 UTC"
          />
          <StatCard
            Icon={Activity}
            label="Antworten diesen Monat"
            value={String(messagesMonth ?? 0)}
            hint={`grob ${estimatedMonthCost} $ geschätzt`}
          />
          <StatCard
            Icon={Database}
            label="Konten"
            value={String(usersTotal ?? 0)}
            hint={provider ? `Provider: ${provider.provider} · ${provider.model}` : "Stub-Modus"}
          />
        </div>

        {/* Whether anyone would actually hear about an incident. This section
            is pull-based — it only helps someone who already suspects a
            problem and logs in to look. The webhook is the push half. */}
        {!alertingConfigured() && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-3 text-[13px] text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>
              Kein Alert-Webhook konfiguriert (<code>ALERT_WEBHOOK_URL</code>). Fehler
              und Warnungen landen nur im Log, niemand wird aktiv benachrichtigt.
            </span>
          </div>
        )}
        <p className="mt-6 text-[12.5px] leading-relaxed text-muted-foreground">
          Kostenschätzung ist eine Grössenordnung, keine Abrechnung: der Streaming-Pfad
          sieht die Token-Zahlen des Anbieters nicht, gerechnet wird mit dem gemessenen
          Worst Case pro Turn. Für echte Zahlen bleibt die Abrechnung beim Anbieter
          massgeblich, und dort gehört zusätzlich ein hartes Ausgabenlimit gesetzt.
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
