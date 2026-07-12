import { NextResponse } from "next/server";
import { chatRequestSchema, type ChatRequest, type ChatMessage } from "@/lib/schemas";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { chatComplete, llmConfig, type LlmOverride } from "@/lib/llm";
import { getUserOverride } from "@/lib/byok";
import { effectiveLimits, type PlanKey } from "@/lib/plans";
import { CHAT_SYSTEM_PROMPT, CODE_CHAT_SYSTEM_PROMPT } from "@/prompts";

export const runtime = "nodejs";
export const maxDuration = 300;

// The client replays the whole running transcript every turn (the route
// itself is stateless) — uncapped, that cost grows with every reply a
// conversation gets, up to the schema's own 50-message ceiling. Only the most
// recent turns matter for continuity — especially in the refine loop, where
// each reply already IS the current, finished version, so older turns are
// largely superseded rather than needed as history. This only trims what goes
// to the model; persistTurn (below) always stores the full turn regardless.
const CHAT_HISTORY_LIMIT = 12;

function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.length > CHAT_HISTORY_LIMIT ? messages.slice(-CHAT_HISTORY_LIMIT) : messages;
}

export async function POST(req: Request) {
  // 1. Parse + validate the transcript the client replays each turn.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problem(400, "Invalid JSON body");
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return problem(400, "Invalid request", {
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const input = parsed.data;

  // 2. Identify the user (optional — anonymous is allowed but rate-limited harder).
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  try {
    supabase = await createClient();
  } catch {
    // No Supabase configured — continue anonymously.
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

  // 3. Rate limit. Chat is chattier than one-shot generation, so the ceiling
  //    is higher (anonymous: 20/hr, authed: 120/hr).
  const limit = userId ? 120 : 20;
  const rl = await rateLimit(rateLimitKey(req, userId), { limit, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return problem(429, "Rate limit exceeded. Try again later.", {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  // 3.5 Enforce the monthly chat allowance for signed-in users, unless
  //     they've configured their own BYOK key. Chat had no monthly cap until
  //     now — only the hourly rate limit above — so a free user with no BYOK
  //     key could otherwise chat all month on the server's own Z.ai key with
  //     no real ceiling (see plans.ts). Checked before the model call, same
  //     principle as /api/generate's project/generation limits.
  let override: LlmOverride | null = null;
  if (userId && supabase) {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    ).toISOString();
    const [{ data: profile }, { count: chatCount }, userOverride] = await Promise.all([
      supabase.from("profiles").select("plan, is_admin").eq("id", userId).maybeSingle(),
      // One row per turn — persistTurn always inserts exactly one assistant
      // reply alongside the user message, so counting only that role avoids
      // double-counting a turn as two units.
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("role", "assistant")
        .gte("created_at", monthStart),
      getUserOverride(supabase, userId),
    ]);
    override = userOverride;
    const rawPlan = (profile?.plan as string | undefined) ?? "free";
    const plan: PlanKey = rawPlan === "pro" || rawPlan === "team" ? rawPlan : "free";
    const limits = effectiveLimits(plan, profile?.is_admin ?? false);
    if (!override && (chatCount ?? 0) >= limits.chatMessages) {
      return problem(
        403,
        `Monatslimit für Chat-Nachrichten erreicht — dein Plan (${plan}) erlaubt ${limits.chatMessages} pro Monat. Upgrade für mehr, oder hinterlege einen eigenen API-Key in den Einstellungen.`,
        { kind: "chatMessages", limit: limits.chatMessages, current: chatCount ?? 0, plan }
      );
    }
  }

  // 4. Build the system instruction.
  //    - general mode  → the everyday prompt engineer (+ optional target hint)
  //    - software mode → the code-refinement assistant
  //    When the chat refines a project (Code mode), append a compact context
  //    block so the assistant knows the build packet it's working on.
  let systemInstruction =
    input.mode === "software" ? CODE_CHAT_SYSTEM_PROMPT : CHAT_SYSTEM_PROMPT;
  if (input.mode !== "software" && input.target) {
    systemInstruction += `\n\nThe user will paste the resulting prompt into: ${input.target}. Tailor wording to that assistant where it helps.`;
  }
  if (input.projectId && userId && supabase) {
    const ctx = await buildProjectContext(supabase, userId, input.projectId);
    if (ctx) systemInstruction += `\n\n${ctx}`;
  }

  // 5. Produce the reply. Without a configured provider (server or BYOK) we
  //    return a useful stub so the whole flow stays testable; otherwise we
  //    replay the transcript through the provider module (lib/llm.ts).
  let reply: string;
  let mode: "stub" | "generated";
  if (!llmConfig() && !override) {
    const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
    reply = stubReply(lastUser?.content ?? "");
    mode = "stub";
  } else {
    try {
      const result = await chatComplete({
        system: systemInstruction,
        messages: trimHistory(input.messages),
        override: override ?? undefined,
      });
      reply = result.text;
      mode = "generated";
    } catch (err) {
      return problem(
        502,
        `Chat fehlgeschlagen: ${err instanceof Error ? err.message : "unbekannt"}`
      );
    }
  }

  // 6. Persist the turn for signed-in users (in both modes), so the chat shows
  //    up in the dashboard and can be reopened/continued. Persistence failures
  //    are surfaced but never block the reply the user is waiting on.
  let conversationId: string | null = input.conversationId ?? null;
  let persistError: string | null = null;
  if (userId && supabase) {
    try {
      conversationId = await persistTurn(supabase, userId, input, reply);
    } catch (err) {
      persistError = err instanceof Error ? err.message : "persist failed";
      conversationId = null;
    }
  }

  return NextResponse.json({
    reply,
    mode,
    ...(conversationId ? { conversationId } : {}),
    ...(persistError ? { persistError } : {}),
  });
}

// Append one chat turn (the new user message + the assistant reply) to its
// conversation, creating the conversation on the first turn. Returns the
// conversation id so the client can echo it back on the next turn.
async function persistTurn(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  userId: string,
  input: ChatRequest,
  reply: string
): Promise<string> {
  let conversationId = input.conversationId ?? null;

  // Confirm the caller still owns the passed conversation (RLS scopes the
  // select to the owner); if it's gone or not theirs, start a fresh one.
  if (conversationId) {
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!existing) conversationId = null;
  }

  if (!conversationId) {
    const title = deriveTitle(input.messages[0]?.content ?? "");
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({
        user_id: userId,
        mode: input.mode,
        target: input.target ?? null,
        title,
        project_id: input.projectId ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    const id = created?.id as string | undefined;
    if (!id) throw new Error("conversation insert returned no id");
    conversationId = id;
  } else {
    // Continued chat — bump updated_at so it sorts to the top of the list.
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  // The client appends the user message before posting, so the last entry is
  // always the new user turn. Store it alongside the assistant reply.
  const newUser = input.messages[input.messages.length - 1];
  const { error: msgErr } = await supabase.from("messages").insert([
    {
      conversation_id: conversationId,
      user_id: userId,
      role: newUser.role,
      content: newUser.content,
    },
    {
      conversation_id: conversationId,
      user_id: userId,
      role: "assistant",
      content: reply,
    },
  ]);
  if (msgErr) throw msgErr;

  return conversationId;
}

// A short, single-line title derived from the opening message.
function deriveTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "Neuer Chat";
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}

// Files share the workspace's total context budget (REDESIGN.md §7): .md
// first (most token-efficient, so it earns priority), then upload order.
// Each file is capped individually so one large file can't crowd out the
// rest; whatever doesn't fit is still named so the assistant knows it exists.
// Halved from the original 24000/6000 (cost pass, 2026-07) — this and every
// budget below gets re-sent on EVERY turn of a project chat, so it's pure
// per-turn cost regardless of how much actually changed since the last turn.
const FILES_TOTAL_BUDGET = 12000;
const FILES_PER_FILE_CAP = 3000;

// Workspace context v2 (REDESIGN.md, Phase 3+4): a project chat works from the
// project's living briefing, not just the original raw idea. Order encodes
// priority — the user's instructions come first and overrule everything else,
// then the structure fields, then attached files, then the legacy idea, then
// the newest saved artifact for reference. Every part is optional (an empty
// workspace simply yields a shorter block); the artifact is detected by
// outputs shape (master-Key = build packet, prompt-Key = saved prompt),
// project.type is legacy data. Returns null when the project isn't found or
// isn't owned by the caller (RLS-scoped read).
async function buildProjectContext(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  userId: string,
  projectId: string
): Promise<string | null> {
  const { data: project } = await supabase
    .from("projects")
    .select("name, idea, instructions, context, tools")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  const { data: generation } = await supabase
    .from("generations")
    .select("outputs")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const outputs = (generation?.outputs ?? {}) as Record<string, string>;

  const parts: string[] = [`Name: ${project.name}`];

  const instructions =
    typeof project.instructions === "string" ? project.instructions.trim() : "";
  if (instructions) {
    parts.push(
      `Instructions (the user's briefing for this project — follow it):\n${truncate(instructions, 3000)}`
    );
  }

  // Structure fields from projects.context; 0011 prefilled legacy tools into
  // it, so old projects keep their stack here without a special path.
  const context =
    project.context && typeof project.context === "object" && !Array.isArray(project.context)
      ? (project.context as Record<string, unknown>)
      : {};
  const structureLines = Object.entries(context)
    .filter((e): e is [string, string] => typeof e[1] === "string" && e[1].trim().length > 0)
    .map(([k, v]) => `- ${k}: ${truncate(v.trim(), 200)}`);
  if (structureLines.length > 0) {
    parts.push(`Structure:\n${structureLines.join("\n")}`);
  }

  const filesBlock = await buildFilesContext(supabase, projectId);
  if (filesBlock) parts.push(filesBlock);

  const idea = typeof project.idea === "string" ? project.idea.trim() : "";
  if (idea) parts.push(`Idea: ${truncate(idea, 1000)}`);

  const master = typeof outputs.master === "string" ? outputs.master : "";
  const prompt = typeof outputs.prompt === "string" ? outputs.prompt : "";
  if (master) {
    parts.push(`Current Master-Prompt artifact (for reference):\n${truncate(master, 1500)}`);
  } else if (prompt) {
    parts.push(`Current saved prompt (for reference):\n${truncate(prompt, 1500)}`);
  }

  return `--- PROJECT CONTEXT (the user is working inside this project) ---
${parts.join("\n\n")}
--- END PROJECT CONTEXT ---`;
}

// Downloads and formats the project's attached files within a shared budget.
// Storage reads happen through the caller's request-scoped client, so RLS
// applies exactly as for the signed-in owner — no service-role needed.
async function buildFilesContext(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  projectId: string
): Promise<string> {
  const { data: filesRaw } = await supabase
    .from("project_files")
    .select("name, storage_path")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  const files = (filesRaw as { name: string; storage_path: string }[] | null) ?? [];
  if (files.length === 0) return "";

  const ordered = [
    ...files.filter((f) => f.name.toLowerCase().endsWith(".md")),
    ...files.filter((f) => !f.name.toLowerCase().endsWith(".md")),
  ];

  const blocks: string[] = [];
  const skipped: string[] = [];
  let remaining = FILES_TOTAL_BUDGET;

  for (const f of ordered) {
    if (remaining <= 0) {
      skipped.push(f.name);
      continue;
    }
    try {
      const { data: blob, error } = await supabase.storage
        .from("project-files")
        .download(f.storage_path);
      if (error || !blob) {
        skipped.push(f.name);
        continue;
      }
      const text = (await blob.text()).trim();
      if (!text) continue;
      const content = truncate(text, Math.min(FILES_PER_FILE_CAP, remaining));
      blocks.push(`File: ${f.name}\n${content}`);
      remaining -= content.length;
    } catch {
      skipped.push(f.name);
    }
  }

  if (blocks.length === 0) return "";
  let block = `Files:\n${blocks.join("\n\n")}`;
  if (skipped.length > 0) {
    block += `\n\n(Also attached but not shown due to context budget: ${skipped.join(", ")})`;
  }
  return block;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// A placeholder answer that mirrors the real shape (a fenced, paste-ready
// prompt) so the UI can be exercised before an API key is configured.
function stubReply(userText: string): string {
  const task = userText.trim() || "[deine Aufgabe]";
  return `_(Demo-Antwort — kein ZAI_API_KEY gesetzt. Trag ihn in \`.env.local\` ein, dann kommt echter KI-Output.)_

Hier ein Grundgerüst, das du anpassen kannst:

\`\`\`text
Du bist ein hilfreicher Experte für [Thema].

Aufgabe: ${task}

Kontext: [wichtige Hintergrundinfos, die die KI kennen muss]

Format: [gewünschtes Ausgabeformat]

Einschränkungen: [Länge, Ton, was vermieden werden soll]
\`\`\`

Sag mir, was ich schärfen soll — kürzer, ausführlicher, mit Beispiel, anderer Ton.`;
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
              : status === 502
                ? "Bad Gateway"
                : "Error",
      status,
      detail,
      ...extra,
    },
    { status, headers: { "content-type": "application/problem+json" } }
  );
}
