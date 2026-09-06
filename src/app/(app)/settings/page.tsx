import { redirect } from "next/navigation";
import { FadeIn } from "@/shared/motion/fade-in";
import { SettingsWorkspace } from "@/features/settings/components/settings-workspace";
import { createClient } from "@/server/supabase/server";
import { effectiveLimits, type PlanKey } from "@/shared/lib/plans";
import { getActiveProvider, getConfiguredProviders, getCustomProvider } from "@/server/byok";
import { chatQuotaKey, getMonthlyQuotaUsage } from "@/server/security/rate-limit";

export const metadata = { title: "Einstellungen" };

// Always reflect the latest stored profile, never a cached snapshot.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Count chat messages within the current calendar month (UTC) only.
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [
    { data: profile },
    { count: projectCount },
    { count: chatCountFromDb },
    configuredProviders,
    customProvider,
    activeProvider,
    redisChatUsage,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, plan, is_admin, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    // RLS scopes both counts to the signed-in owner; the explicit owner filter
    // below is defense in depth on top of it.
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
    getCustomProvider(supabase, user.id),
    getActiveProvider(supabase, user.id),
    // M-3 (Audit 06.09.2026): see billing/page.tsx's identical read for why —
    // the DB count above drops when old chats are deleted, this Redis counter
    // (the one /api/chat actually enforces against) doesn't.
    getMonthlyQuotaUsage(chatQuotaKey(user.id)),
  ]);
  const chatCount = redisChatUsage ?? chatCountFromDb;

  const email = user.email ?? "";
  const displayName = profile?.display_name ?? email.split("@")[0] ?? "";
  const plan = (profile?.plan ?? "free") as PlanKey;
  const isAdmin = profile?.is_admin ?? false;
  const limits = effectiveLimits(plan, isAdmin);
  // A configured BYOK key lifts the chat cap (see api/chat); UsageMeter already
  // renders "Unbegrenzt" for a non-finite limit.
  const hasByok = configuredProviders.length > 0;
  const chatLimit = hasByok ? Infinity : limits.chatMessages;

  return (
    <div>
      <FadeIn>
        <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
          Einstellungen
        </h1>
        {/* M-18 (Audit 06.09.2026): "Standardwerte" nannte die inzwischen
            entfernte "Standard-Tools"-Karte (settings-workspace.tsx). */}
        <p className="mt-1.5 text-[14px] text-secondary mb-8">
          Profil, Workspace und Sicherheit an einem Ort.
        </p>
      </FadeIn>

      <SettingsWorkspace
        userId={user.id}
        email={email}
        initialDisplayName={displayName}
        initialAvatarUrl={profile?.avatar_url ?? null}
        plan={plan}
        isAdmin={isAdmin}
        usage={{
          projects: projectCount ?? 0,
          projectLimit: limits.projects,
          chatMessages: chatCount ?? 0,
          chatMessageLimit: chatLimit,
        }}
        memberSince={user.created_at ?? null}
        configuredProviders={configuredProviders}
        activeProvider={activeProvider}
        customProvider={customProvider}
      />
    </div>
  );
}
