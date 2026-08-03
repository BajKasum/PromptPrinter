import { notFound } from "next/navigation";
import { AlertTriangle, Activity, Database, Gauge } from "lucide-react";
import { AppHeader } from "@/shell/components/app-header";
import { FadeIn } from "@/shared/motion/fade-in";
import { UsageMeter } from "@/features/settings/components/usage-meter";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import { readDailyServerKeyUsage } from "@/server/security/rate-limit";
import { alertingConfigured } from "@/shared/lib/alerting";
import { llmConfig } from "@/server/llm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Betrieb" };

// The visible half of QA finding C-7. Structured logs answer "what happened"
// after the fact; this page answers "is something draining my key right now",
// which is the question the anonymous-chat hole (S-1) went unanswered on for as
// long as it was open. Deliberately small: four numbers that would each have
// moved during that incident, not a dashboard product.
//
// Cross-user counts need the service-role client — RLS scopes the normal one to
// the caller, which is the whole point everywhere else. Safe here because the
// is_admin gate runs first and 404s anyone else (404, not 403: an admin area
// nobody else needs to know exists).
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) notFound();

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
    <div>
      <AppHeader
        mascot="organizing"
        title="Betrieb"
        subtitle="Die Zahlen, an denen ein Kostenausreisser zuerst sichtbar wird."
      />

      <FadeIn>
        <section className="card-surface mb-4 p-6">
          <h2 className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <Gauge className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
            Server-Key heute
          </h2>
          <p className="mb-5 text-[13px] leading-relaxed text-muted-foreground">
            Modell-Aufrufe auf dem eigenen Key, global über alle Nutzer. Greift die
            Bremse, laufen BYOK-Nutzer weiter.
          </p>
          {serverKey ? (
            <UsageMeter
              label="Aufrufe heute"
              used={serverKey.used}
              limit={serverKey.budget}
            />
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
        </section>
      </FadeIn>

      <FadeIn delay={0.06}>
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
      </FadeIn>

      <FadeIn delay={0.12}>
        {/* Whether anyone would actually hear about an incident. This page is
            pull-based — it only helps someone who already suspects a problem
            and logs in to look. The webhook is the push half. */}
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
      </FadeIn>
    </div>
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
