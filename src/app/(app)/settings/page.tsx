import { redirect } from "next/navigation";
import { FadeIn } from "@/components/motion/fade-in";
import { SettingsWorkspace } from "@/components/app/settings-workspace";
import { parseToolDefaults } from "@/lib/tools";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Einstellungen" };

// Always reflect the latest stored profile, never a cached snapshot.
export const dynamic = "force-dynamic";

type PlanKey = "free" | "pro" | "team";

// Marketed allowances per plan — mirrors the pricing page so the usage meters
// match what the user was sold.
const PLAN_LIMITS: Record<PlanKey, { projects: number; generations: number }> = {
  free: { projects: 3, generations: 20 },
  pro: { projects: Infinity, generations: 500 },
  team: { projects: Infinity, generations: 500 },
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Count generations within the current calendar month (UTC) only.
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [{ data: profile }, { count: projectCount }, { count: genCount }] = await Promise.all([
    supabase.from("profiles").select("display_name, settings, plan").eq("id", user.id).maybeSingle(),
    // RLS scopes both counts to the signed-in owner.
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase
      .from("generations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart),
  ]);

  const email = user.email ?? "";
  const displayName = profile?.display_name ?? email.split("@")[0] ?? "";
  const toolDefaults = parseToolDefaults(profile?.settings);
  const plan = (profile?.plan ?? "free") as PlanKey;
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  // Only forward a genuine settings object so the client can safely merge it.
  const rawSettings = profile?.settings;
  const baseSettings =
    rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)
      ? (rawSettings as Record<string, unknown>)
      : null;

  return (
    <div className="max-w-[1080px]">
      <FadeIn>
        <h1 className="text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.03em] font-semibold text-white">
          Einstellungen
        </h1>
        <p className="mt-1.5 text-[14px] text-white/55 mb-8">
          Profil, Workspace und Standardwerte — alles an einem Ort.
        </p>
      </FadeIn>

      <SettingsWorkspace
        userId={user.id}
        email={email}
        initialDisplayName={displayName}
        initialTools={toolDefaults}
        baseSettings={baseSettings}
        plan={plan}
        usage={{
          projects: projectCount ?? 0,
          projectLimit: limits.projects,
          generations: genCount ?? 0,
          generationLimit: limits.generations,
        }}
        memberSince={user.created_at ?? null}
      />
    </div>
  );
}
