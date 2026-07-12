import type { GenerateRequest } from "@/lib/schemas";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export type PersistResult = { projectId: string | null; persistError: string | null };

/**
 * Persists one generation run for a signed-in caller — in both stub and
 * generated mode, so the project shows up regardless of whether a real
 * model call ran. A projectId on the input means this is a workspace-native
 * handoff: no new project, just another generation row for the existing one
 * (ownership already verified by the caller, see generate-guards.ts).
 * Persistence failures are surfaced but never thrown — the caller still has
 * a usable `outputs` to hand back even if storing it failed.
 */
export async function persistGeneration(
  supabase: SupabaseServerClient,
  userId: string,
  input: GenerateRequest,
  outputs: Record<string, string>,
  model: string | null,
  tokensIn: number,
  tokensOut: number
): Promise<PersistResult> {
  let projectId: string | null = null;
  let persistError: string | null = null;

  try {
    if (input.projectId) {
      projectId = input.projectId;
    } else {
      // One explicit row type for both packs. Without it, the two branches
      // produce a union with differing `tools` shapes, which Supabase's
      // insert typing (RejectExcessProperties) rejects. `tools` is a jsonb
      // column, so Record<string, string> covers both the four build tools
      // and the general pack's { target }.
      const projectRow: {
        user_id: string;
        name: string;
        audience: string;
        idea: string;
        tools: Record<string, string>;
        type: string;
        status: string;
      } =
        input.type === "general"
          ? {
              user_id: userId,
              name: input.name,
              // The general pack has no audience; store the target assistant so
              // the dashboard card still has a meaningful subtitle.
              audience: input.target,
              idea: input.idea,
              tools: { target: input.target },
              type: "general",
              status: "ready",
            }
          : {
              user_id: userId,
              name: input.name,
              audience: input.audience,
              idea: input.idea,
              tools: input.tools,
              type: "software",
              status: "ready",
            };

      const { data: project, error: projectErr } = await supabase
        .from("projects")
        .insert(projectRow)
        .select("id")
        .single();

      if (projectErr) throw projectErr;
      projectId = project?.id ?? null;
    }

    if (projectId) {
      const { error: genErr } = await supabase.from("generations").insert({
        project_id: projectId,
        user_id: userId,
        outputs,
        model,
        tokens_in: tokensIn > 0 ? tokensIn : null,
        tokens_out: tokensOut > 0 ? tokensOut : null,
      });
      if (genErr) throw genErr;
    }
  } catch (err) {
    // Surface persistence failures instead of silently dropping them — a
    // missing profile row or RLS issue would otherwise look like success.
    persistError = err instanceof Error ? err.message : "persist failed";
    projectId = null;
  }

  return { projectId, persistError };
}
