import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { generateRequestSchema } from "@/lib/schemas";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS, type PlanKey } from "@/lib/plans";
import {
  SYSTEM_PROMPT,
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
  type GenerationInput,
} from "@/prompts";

export const runtime = "nodejs";
export const maxDuration = 300;

// Gemini 3.5 Flash — the GA/stable successor to the gemini-3-flash-preview
// line; Pro-level quality at Flash speed/price. A launch-bound product should
// default to GA, not a preview model. Overridable via GEMINI_MODEL so it can be
// bumped without a code change once newer versions ship.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

// Gemini 3 models spend part of their output budget on internal "thinking",
// so a tight cap can starve the visible answer. 8k leaves room for both the
// reasoning and a full-length artifact.
const MAX_OUTPUT_TOKENS = 8192;

export async function POST(req: Request) {
  // 1. Parse + validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problem(400, "Invalid JSON body");
  }

  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return problem(400, "Invalid request", {
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const input: GenerationInput = parsed.data;

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
  const rl = rateLimit(rateLimitKey(req, userId), { limit, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return problem(429, "Rate limit exceeded. Try again later.", {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  // 3.5 Enforce plan allowances for signed-in users. Anonymous callers persist
  //     nothing, so only the rate limit gates them. Done before the Gemini calls
  //     so an over-limit request never burns API quota or writes a row.
  if (userId && supabase) {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    ).toISOString();
    const [{ data: profile }, { count: projectCount }, { count: genCount }] =
      await Promise.all([
        supabase.from("profiles").select("plan").eq("id", userId).maybeSingle(),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase
          .from("generations")
          .select("id", { count: "exact", head: true })
          .gte("created_at", monthStart),
      ]);
    const rawPlan = (profile?.plan as string | undefined) ?? "free";
    const plan: PlanKey = rawPlan === "pro" || rawPlan === "team" ? rawPlan : "free";
    const limits = PLAN_LIMITS[plan];
    if ((projectCount ?? 0) >= limits.projects) {
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

  // 4. Build prompt set
  const prompts = {
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

  // 5. Produce the outputs.
  //    - With an API key: call Gemini for each artifact.
  //    - Without a key: fall back to the unfilled templates so the flow still works.
  const apiKey = process.env.GEMINI_API_KEY;
  const mode: "generated" | "stub" = apiKey ? "generated" : "stub";
  const outputs: Record<string, string> = {};

  if (apiKey) {
    const ai = new GoogleGenAI({ apiKey });
    const calls = Object.entries(prompts).map(async ([key, prompt]) => {
      try {
        const res = await ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          },
        });
        // `text` is undefined when the response was blocked or fully consumed
        // by thinking — fall back to the unfilled template so every artifact
        // still has usable content rather than an empty box.
        const text = res.text?.trim();
        outputs[key] = text && text.length > 0 ? text : prompt;
      } catch (err) {
        outputs[key] = `_Generation failed: ${err instanceof Error ? err.message : "unknown"}_`;
      }
    });
    await Promise.all(calls);
  } else {
    Object.assign(outputs, prompts);
  }

  // 6. Persist for logged-in users — in BOTH modes, so the project shows up
  //    in the dashboard regardless of whether real generation ran.
  let projectId: string | null = null;
  let persistError: string | null = null;
  if (userId && supabase) {
    try {
      const { data: project, error: projectErr } = await supabase
        .from("projects")
        .insert({
          user_id: userId,
          name: input.name,
          audience: input.audience,
          idea: input.idea,
          tools: input.tools,
          status: "ready",
        })
        .select("id")
        .single();

      if (projectErr) throw projectErr;
      projectId = project?.id ?? null;

      if (projectId) {
        const { error: genErr } = await supabase.from("generations").insert({
          project_id: projectId,
          user_id: userId,
          outputs,
          model: mode === "generated" ? MODEL : null,
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
      ? { message: "Kein GEMINI_API_KEY gesetzt — es wurden die Prompt-Vorlagen gespeichert. Trag den Key in .env ein für echte Generierung." }
      : {}),
  });
}

function problem(status: number, detail: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      type: "about:blank",
      title:
        status === 400
          ? "Bad Request"
          : status === 403
            ? "Forbidden"
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
