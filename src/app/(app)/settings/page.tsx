import { redirect } from "next/navigation";
import { FadeIn } from "@/shared/motion/fade-in";
import { SettingsWorkspace } from "@/features/settings/components/settings-workspace";
import { createClient } from "@/server/supabase/server";
import type { PlanKey } from "@/shared/lib/plans";
import { getActiveProvider, getConfiguredProviders, getCustomProvider } from "@/server/byok";

export const metadata = { title: "Einstellungen" };

// Always reflect the latest stored profile, never a cached snapshot.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, configuredProviders, customProvider, activeProvider] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, plan, is_admin")
        .eq("id", user.id)
        .maybeSingle(),
      getConfiguredProviders(supabase, user.id),
      getCustomProvider(supabase, user.id),
      getActiveProvider(supabase, user.id),
    ]);

  const email = user.email ?? "";
  const displayName = profile?.display_name ?? email.split("@")[0] ?? "";
  const plan = (profile?.plan ?? "free") as PlanKey;
  const isAdmin = profile?.is_admin ?? false;

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
        plan={plan}
        isAdmin={isAdmin}
        memberSince={user.created_at ?? null}
        configuredProviders={configuredProviders}
        activeProvider={activeProvider}
        customProvider={customProvider}
      />
    </div>
  );
}
