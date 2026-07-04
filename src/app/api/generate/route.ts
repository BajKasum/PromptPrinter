import { NextResponse } from "next/server";
import { generateRequestSchema, type GenerateRequest } from "@/lib/schemas";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { chatCompleteSequential, llmConfig, LlmEmptyReplyError } from "@/lib/llm";
import { effectiveLimits, type PlanKey } from "@/lib/plans";
import {
  SYSTEM_PROMPT,
  GENERAL_SYSTEM_PROMPT,
  briefTemplate,
  prdTemplate,
  masterPromptTemplate,
  frontendPromptTemplate,
  backendPromptTemplate,
  schemaTemplate,
  securityTemplate,
  marketingTemplate,
  seoTemplate,
  deploymentTemplate,
  generalPromptTemplate,
  generalVariantTemplate,
  GENERAL_VARIANTS,
} from "@/prompts";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  // 1. Parse + validate body
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
  //    The client is hoisted so the plan-limit check and the persistence step
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

  // 3. Rate limit (anonymous: 5/hr, authed: 30/hr)
  const limit = userId ? 30 : 5;
  const rl = await rateLimit(rateLimitKey(req, userId), { limit, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return problem(429, "Rate limit exceeded. Try again later.", {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  // 3.5 Enforce plan allowances for signed-in users. Anonymous callers persist
  //     nothing, so only the rate limit gates them. Done before the model calls
  //     so an over-limit request never burns API quota or writes a row.
  if (userId && supabase) {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    ).toISOString();
    const [{ data: profile }, { count: projectCount }, { count: genCount }] =
      await Promise.all([
        supabase.from("profiles").select("plan, is_admin").eq("id", userId).maybeSingle(),
        // Filter by owner explicitly even though RLS already scopes these to the
        // caller — defense in depth. These counts gate resource creation, so a
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
      ]);
    const rawPlan = (profile?.plan as string | undefined) ?? "free";
    const plan: PlanKey = rawPlan === "pro" || rawPlan === "team" ? rawPlan : "free";
    // Admin is a role, not a plan (profiles.is_admin) — it exempts this one
    // account from every limit below without changing what plan it's on.
    const limits = effectiveLimits(plan, profile?.is_admin ?? false);
    // Generating into an existing project (workspace-native handoff) never
    // creates a project row, so the project cap doesn't apply — only a fresh
    // standalone generation (no projectId) is gated by it.
    if (!input.projectId && (projectCount ?? 0) >= limits.projects) {
      return problem(
        403,
        `Projekt-Limit erreicht — dein Plan (${plan}) erlaubt ${limits.projects} Projekte. Upgrade für mehr.`,
        { kind: "projects", limit: limits.projects, current: projectCount ?? 0, plan }
      );
    }
    if ((genCount ?? 0) >= limits.generations) {
      return problem(
        403,
        `Monatslimit für Generierungen erreicht — dein Plan (${plan}) erlaubt ${limits.generations} pro Monat. Upgrade für mehr.`,
        { kind: "generations", limit: limits.generations, current: genCount ?? 0, plan }
      );
    }
  }

  // 3.6 Generating into an existing project requires ownership — verify before
  //     spending a model call. A missing/foreign id must fail loudly instead
  //     of silently creating an orphan generation; anonymous callers can never
  //     own a project, so they're rejected outright.
  if (input.projectId) {
    if (!userId || !supabase) {
      return problem(401, "Anmeldung erforderlich, um ein Ergebnis in einem Projekt zu erzeugen.");
    }
    const { data: existingProject } = await supabase
      .from("projects")
      .select("id")
      .eq("id", input.projectId)
      .maybeSingle();
    if (!existingProject) {
      return problem(404, "Projekt nicht gefunden.");
    }
  }

  // 4. Build the prompt set + system instruction for the chosen pack.
  let prompts: Record<string, string>;
  let systemInstruction: string;
  if (input.type === "general") {
    prompts = {
      prompt: generalPromptTemplate(input),
      ...Object.fromEntries(
        GENERAL_VARIANTS.map((v) => [v.key, generalVariantTemplate(input, v.angle)])
      ),
    };
    systemInstruction = GENERAL_SYSTEM_PROMPT;
  } else {
    prompts = {
      brief: briefTemplate(input),
      prd: prdTemplate(input),
      master: masterPromptTemplate(input),
      frontend: frontendPromptTemplate(input),
      backend: backendPromptTemplate(input),
      schema: schemaTemplate(input),
      security: securityTemplate(input),
      marketing: marketingTemplate(input),
      seo: seoTemplate(input),
      deployment: deploymentTemplate(input),
    };
    systemInstruction = SYSTEM_PROMPT;
  }

  // 5. Produce the outputs.
  //    - With a configured provider (Z.ai primary, see lib/llm.ts): one
  //      completion per artifact, run strictly one at a time (with a 429
  //      retry) via chatCompleteSequential — Z.ai's current plan can't
  //      sustain the up-to-10-way parallel fan-out this used to do (see
  //      lib/llm.ts), so sequencing here is what makes a run actually come
  //      back with real content instead of mostly "_Generation failed_".
  //    - Without one: fall back to the unfilled templates so the flow still works.
  const llm = llmConfig();
  const mode: "generated" | "stub" = llm ? "generated" : "stub";
  const outputs: Record<string, string> = {};
  // Summed across all artifact calls of this run; stored on the generation row
  // so the Verlauf can show what a run actually cost.
  let tokensIn = 0;
  let tokensOut = 0;

  if (llm) {
    const results = await chatCompleteSequential(systemInstruction, prompts);
    for (const [key, entry] of Object.entries(results)) {
      if (entry.result) {
        outputs[key] = entry.result.text;
        if (entry.result.usage) {
          tokensIn += entry.result.usage.inputTokens;
          tokensOut += entry.result.usage.outputTokens;
        }
      } else {
        // An empty reply degrades to the unfilled template — still usable
        // content instead of an empty box. Real errors surface visibly.
        outputs[key] =
          entry.error instanceof LlmEmptyReplyError
            ? prompts[key]
            : `_Generation failed: ${entry.error instanceof Error ? entry.error.message : "unknown"}_`;
      }
    }
  } else {
    Object.assign(outputs, prompts);
  }

  // 5.5 The overview is a faithful summary of THIS run's actual input, not a
  //     model call — a project can now carry several generations over time
  //     (workspace-native handoff), so reconstructing it later from the
  //     project row (which only holds the latest/legacy values) would drift.
  //     Deterministic and un-timestamped so it never goes stale once stored.
  outputs.overview = input.type === "general" ? buildGeneralOverview(input) : buildSoftwareOverview(input);

  // 6. Persist for logged-in users — in BOTH modes, so the project shows up
  //    regardless of whether real generation ran. A projectId in the input
  //    means this is a workspace-native handoff: no new project, just another
  //    generation row for the existing one (ownership already verified above).
  let projectId: string | null = null;
  let persistError: string | null = null;
  if (userId && supabase) {
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
          model: llm ? llm.model : null,
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
  }

  return NextResponse.json({
    projectId: projectId ?? "demo",
    outputs,
    mode,
    ...(persistError ? { persistError } : {}),
    ...(mode === "stub"
      ? { message: "Kein ZAI_API_KEY gesetzt — es wurden die Prompt-Vorlagen gespeichert. Trag den Key in .env.local (Dev) bzw. .env (Prod-Docker) ein für echte Generierung." }
      : {}),
  });
}

function buildSoftwareOverview(input: Extract<GenerateRequest, { type: "software" }>): string {
  return `# ${input.name} — Übersicht

**Zielgruppe** ${input.audience}

## Idee
${input.idea}

## Stack
- **Master-Prompt** — ${input.tools.master}
- **Frontend** — ${input.tools.frontend}
- **Backend** — ${input.tools.backend}
- **Datenbank** — ${input.tools.database}

## Nächste Schritte
- **Master-Prompt** — in deinen KI-Assistenten einfügen, um das Scaffolding zu starten
- **Datenbank-Schema** — zuerst im Supabase SQL-Editor ausführen
- **Frontend-Prompt** — in Lovable oder v0 einfügen
`;
}

function buildGeneralOverview(input: Extract<GenerateRequest, { type: "general" }>): string {
  return `# ${input.name} — Übersicht

**Typ** Prompt  •  **Ziel-KI** ${input.target}

## Ziel
${input.idea}

## Enthalten
- **Haupt-Prompt** — die ausgewogene, fertige Version
- **Varianten** — knapp & direkt, ausführlich & geführt, rollenbasiert

## So nutzt du es
Kopiere den Haupt-Prompt und füge ihn in ${input.target} ein. Greif zu einer Variante, wenn du einen anderen Ton oder mehr Führung brauchst.
`;
}

function problem(status: number, detail: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      type: "about:blank",
      title:
        status === 400
          ? "Bad Request"
          : status === 401
            ? "Unauthorized"
            : status === 403
              ? "Forbidden"
              : status === 404
                ? "Not Found"
                : status === 429
                  ? "Too Many Requests"
                  : "Error",
      status,
      detail,
      ...extra,
    },
    { status, headers: { "content-type": "application/problem+json" } }
  );
}
