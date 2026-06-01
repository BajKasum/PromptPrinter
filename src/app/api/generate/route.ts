import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generateRequestSchema } from "@/lib/schemas";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
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

const MODEL = "claude-opus-4-7";

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

  // 2. Identify user (optional — anonymous is allowed but rate-limited harder)
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    // No Supabase configured — fall through anonymously.
  }

  // 3. Rate limit (anonymous: 5/hr, authed: 30/hr)
  const limit = userId ? 30 : 5;
  const rl = rateLimit(rateLimitKey(req, userId), { limit, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return problem(429, "Rate limit exceeded. Try again later.", {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
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
  //    - With an API key: call Claude for each artifact.
  //    - Without a key: fall back to the unfilled templates so the flow still works.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const mode: "generated" | "stub" = apiKey ? "generated" : "stub";
  const outputs: Record<string, string> = {};

  if (apiKey) {
    const client = new Anthropic({ apiKey });
    const calls = Object.entries(prompts).map(async ([key, prompt]) => {
      try {
        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        });
        outputs[key] = res.content
          .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
          .map((b) => b.text)
          .join("\n");
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
  if (userId) {
    try {
      const supabase = await createClient();
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
      ? { message: "Kein ANTHROPIC_API_KEY gesetzt — es wurden die Prompt-Vorlagen gespeichert. Trag den Key in .env ein für echte Generierung." }
      : {}),
  });
}

function problem(status: number, detail: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      type: "about:blank",
      title: status === 400 ? "Bad Request" : status === 429 ? "Too Many Requests" : "Error",
      status,
      detail,
      ...extra,
    },
    { status, headers: { "content-type": "application/problem+json" } }
  );
}
