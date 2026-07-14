import { getUserOverride } from "@/lib/byok";
import type { LlmOverride } from "@/lib/llm";
import { effectiveLimits, type PlanKey } from "@/lib/plans";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export type GenerateAllowance =
  | { allowed: true; override: LlmOverride | null }
  | { allowed: false; status: number; detail: string; extra: Record<string, unknown> };

/**
 * Plan allowances for a signed-in caller of /api/generate, project cap and
 * monthly generation cap, both before any model call so an over-limit
 * request never burns API quota or writes a row. A BYOK key (own Anthropic/
 * OpenAI/Gemini account, settings) skips the generations check entirely,
 * that cost is on the user's own account, not ours, so metering it against
 * our allowance makes no sense. The project cap still applies: that one is
 * about our storage/infra, not AI cost, so BYOK doesn't change it.
 *
 * Only call this for a signed-in caller (userId + supabase both present),
 * anonymous callers persist nothing, so only the route's rate limit gates
 * them; this function assumes an authenticated context.
 */
export async function checkGenerateAllowance(
  supabase: SupabaseServerClient,
  userId: string,
  hasExistingProjectId: boolean
): Promise<GenerateAllowance> {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();

  const [{ data: profile }, { count: projectCount }, { count: genCount }, override] =
    await Promise.all([
      supabase.from("profiles").select("plan, is_admin").eq("id", userId).maybeSingle(),
      // Filter by owner explicitly even though RLS already scopes these to the
      // caller, defense in depth. These counts gate resource creation, so a
      // single mis-scoped policy must never let them read the global total.
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("generations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", monthStart),
      getUserOverride(supabase, userId),
    ]);

  const rawPlan = (profile?.plan as string | undefined) ?? "free";
  const plan: PlanKey = rawPlan === "pro" || rawPlan === "team" ? rawPlan : "free";
  // Admin is a role, not a plan (profiles.is_admin), it exempts this one
  // account from every limit below without changing what plan it's on.
  const limits = effectiveLimits(plan, profile?.is_admin ?? false);

  // Generating into an existing project (workspace-native handoff) never
  // creates a project row, so the project cap doesn't apply, only a fresh
  // standalone generation (no projectId) is gated by it.
  if (!hasExistingProjectId && (projectCount ?? 0) >= limits.projects) {
    return {
      allowed: false,
      status: 403,
      detail: `Projekt-Limit erreicht, dein Plan (${plan}) erlaubt ${limits.projects} Projekte. Upgrade für mehr.`,
      extra: { kind: "projects", limit: limits.projects, current: projectCount ?? 0, plan },
    };
  }
  if (!override && (genCount ?? 0) >= limits.generations) {
    return {
      allowed: false,
      status: 403,
      detail: `Monatslimit für Generierungen erreicht, dein Plan (${plan}) erlaubt ${limits.generations} pro Monat. Upgrade für mehr.`,
      extra: { kind: "generations", limit: limits.generations, current: genCount ?? 0, plan },
    };
  }

  return { allowed: true, override };
}

export type OwnershipCheck = { ok: true } | { ok: false; status: number; detail: string };

/**
 * Generating into an existing project requires ownership, verify before
 * spending a model call. A missing/foreign id must fail loudly instead of
 * silently creating an orphan generation. Relies on RLS to scope the lookup
 * to the caller's own client, so it doesn't take a userId, the caller is
 * responsible for having already rejected anonymous requests (a project
 * handoff always requires a signed-in owner).
 */
export async function verifyProjectOwnership(
  supabase: SupabaseServerClient,
  projectId: string
): Promise<OwnershipCheck> {
  const { data: existingProject } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!existingProject) {
    return { ok: false, status: 404, detail: "Projekt nicht gefunden." };
  }
  return { ok: true };
}
