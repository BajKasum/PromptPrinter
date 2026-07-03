import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { chatRequestSchema, type ChatRequest } from "@/lib/schemas";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { CHAT_SYSTEM_PROMPT, CODE_CHAT_SYSTEM_PROMPT } from "@/prompts";

export const runtime = "nodejs";
export const maxDuration = 300;

// Same model + budget as the one-shot generator; a chat turn is just a
// multi-message call against the same Flash model.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
const MAX_OUTPUT_TOKENS = 8192;

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

  // 5. Produce the reply. Without a key we return a useful stub so the whole
  //    flow stays testable; with one we replay the transcript to Gemini
  //    (assistant → "model", user → "user").
  const apiKey = process.env.GEMINI_API_KEY;
  let reply: string;
  let mode: "stub" | "generated";
  if (!apiKey) {
    const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
    reply = stubReply(lastUser?.content ?? "");
    mode = "stub";
  } else {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const contents = input.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const res = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: { systemInstruction, maxOutputTokens: MAX_OUTPUT_TOKENS },
      });
      const text = res.text?.trim();
      if (!text) {
        return problem(502, "Leere Antwort vom Modell — versuch es nochmal.");
      }
      reply = text;
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
const FILES_TOTAL_BUDGET = 24000;
const FILES_PER_FILE_CAP = 6000;

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
      `Instructions (the user's briefing for this project — follow it):\n${truncate(instructions, 4000)}`
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
  if (idea) parts.push(`Idea: ${truncate(idea, 1200)}`);

  const master = typeof outputs.master === "string" ? outputs.master : "";
  const prompt = typeof outputs.prompt === "string" ? outputs.prompt : "";
  if (master) {
    parts.push(`Current Master-Prompt artifact (for reference):\n${truncate(master, 2400)}`);
  } else if (prompt) {
    parts.push(`Current saved prompt (for reference):\n${truncate(prompt, 2400)}`);
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
// prompt) so the UI can be exercised before a GEMINI_API_KEY is configured.
function stubReply(userText: string): string {
  const task = userText.trim() || "[deine Aufgabe]";
  return `_(Demo-Antwort — kein GEMINI_API_KEY gesetzt. Trag ihn in \`.env.local\` ein, dann kommt echter KI-Output.)_

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
