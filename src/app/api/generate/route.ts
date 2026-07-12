import { NextResponse } from "next/server";
import { generateRequestSchema } from "@/lib/schemas";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { LlmOverride } from "@/lib/llm";
import { problem } from "@/lib/api-problem";
import { checkGenerateAllowance, verifyProjectOwnership } from "@/lib/generate-guards";
import { buildPromptSet, buildOverview } from "@/lib/build-generate-content";
import { runGeneration } from "@/lib/run-generation";
import { persistGeneration } from "@/lib/persist-generation";

export const runtime = "nodejs";
export const maxDuration = 300;

// Orchestrator only — each step below is a single call into a focused,
// independently testable module (lib/generate-guards.ts,
// lib/build-generate-content.ts, lib/run-generation.ts,
// lib/persist-generation.ts). This route used to carry all of that inline;
// a change to billing, limits or prompt strategy could drag three unrelated
// things with it. Splitting it doesn't change behavior, only where it lives.
export async function POST(req: Request) {
  // 1. Parse + validate body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problem(400, "Invalid JSON body");
  }

  // Back-compat: older clients posted no `type` (software was the only pack).
  if (body && typeof body === "object" && !("type" in body)) {
    (body as Record<string, unknown>).type = "software";
  }

  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return problem(400, "Invalid request", {
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const input = parsed.data;

  // 2. Identify user (optional — anonymous is allowed but rate-limited harder).
  //    The client is hoisted so the allowance check and the persistence step
  //    below can reuse it instead of re-creating one per phase.
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  try {
    supabase = await createClient();
  } catch {
    // No Supabase configured — fall through anonymously.
  }
  let userId: string | null = null;
  if (supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      // Auth lookup failed — treat as anonymous.
    }
  }

  // 3. Rate limit (anonymous: 5/hr, authed: 30/hr).
  const limit = userId ? 30 : 5;
  const rl = await rateLimit(rateLimitKey(req, userId), { limit, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return problem(429, "Rate limit exceeded. Try again later.", {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  // 4. Plan allowances for signed-in callers (project cap, generation cap
  //    unless BYOK) + resolve their BYOK override, if any. Anonymous callers
  //    persist nothing, so only the rate limit above gates them.
  let override: LlmOverride | null = null;
  if (userId && supabase) {
    const allowance = await checkGenerateAllowance(supabase, userId, !!input.projectId);
    if (!allowance.allowed) {
      return problem(allowance.status, allowance.detail, allowance.extra);
    }
    override = allowance.override;
  }

  // 5. A projectId means this is a workspace-native handoff — verify
  //    ownership before spending a model call. A missing/foreign id must
  //    fail loudly instead of silently creating an orphan generation;
  //    anonymous callers can never own a project, so they're rejected
  //    outright.
  if (input.projectId) {
    if (!userId || !supabase) {
      return problem(401, "Anmeldung erforderlich, um ein Ergebnis in einem Projekt zu erzeugen.");
    }
    const ownership = await verifyProjectOwnership(supabase, input.projectId);
    if (!ownership.ok) {
      return problem(ownership.status, ownership.detail);
    }
  }

  // 6. Build the prompt set for the chosen pack, run it, and attach the
  //    deterministic overview (not a model call, see build-generate-content.ts).
  const { prompts, systemInstruction } = buildPromptSet(input);
  const { outputs, mode, tokensIn, tokensOut, model } = await runGeneration(
    systemInstruction,
    prompts,
    override
  );
  outputs.overview = buildOverview(input);

  // 7. Persist for signed-in users — in both modes, so the project shows up
  //    regardless of whether real generation ran.
  let projectId: string | null = null;
  let persistError: string | null = null;
  if (userId && supabase) {
    const persisted = await persistGeneration(
      supabase,
      userId,
      input,
      outputs,
      model,
      tokensIn,
      tokensOut
    );
    projectId = persisted.projectId;
    persistError = persisted.persistError;
  }

  return NextResponse.json({
    projectId: projectId ?? "demo",
    outputs,
    mode,
    ...(persistError ? { persistError } : {}),
    ...(mode === "stub"
      ? {
          message:
            "Die KI-Anbindung ist gerade nicht aktiv — es wurden die Prompt-Vorlagen ungefüllt gespeichert.",
        }
      : {}),
  });
}
