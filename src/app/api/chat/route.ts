import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { chatRequestSchema, type ChatRequest } from "@/lib/schemas";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { CHAT_SYSTEM_PROMPT } from "@/prompts";

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

  // 4. Build the system instruction. Both modes share the conversational prompt
  //    engineer; the chosen target assistant is appended as a styling hint.
  const systemInstruction = input.target
    ? `${CHAT_SYSTEM_PROMPT}\n\nThe user will paste the resulting prompt into: ${input.target}. Tailor wording to that assistant where it helps.`
    : CHAT_SYSTEM_PROMPT;

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
