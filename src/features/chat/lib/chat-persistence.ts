import { truncate, MAX_ASSISTANT_MESSAGE_CHARS } from "@/shared/lib/chat-limits";
import type { ChatRequest } from "@/shared/lib/schemas";
import type { createClient } from "@/server/supabase/server";

// Persists one chat turn for /api/chat. Split out of route.ts (QA finding
// C-1) purely to shrink that file and make this testable in isolation; no
// behavior change.

// Append one chat turn (the new user message + the assistant reply) to its
// conversation, creating the conversation on the first turn. Returns the
// conversation id so the client can echo it back on the next turn.
export async function persistTurn(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  userId: string,
  input: ChatRequest,
  reply: string,
  // Explicit, ownership-verified project id (QA finding F-8) — never read
  // input.projectId directly here, that's the unverified value straight off
  // the wire. Callers pass the value buildProjectContext already confirmed
  // exists and belongs to this user (or null, for a global chat / an
  // unowned-or-missing project, which persistTurn treats identically).
  verifiedProjectId: string | null
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
        target: input.target ?? null,
        title,
        project_id: verifiedProjectId,
      })
      .select("id")
      .single();
    if (error) throw error;
    const id = created?.id as string | undefined;
    if (!id) throw new Error("conversation insert returned no id");
    conversationId = id;
  } else {
    // Continued chat, bump updated_at so it sorts to the top of the list, and
    // carry over a target the user changed mid-conversation — it used to be
    // written only at creation, so switching the build tool later was accepted
    // for that one turn and then silently forgotten.
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString(), target: input.target ?? null })
      .eq("id", conversationId);
  }

  // The client appends the user message before posting, so the last entry is
  // always the new user turn. route.ts enforces this as a real validation
  // step before calling persistTurn (Security-Audit finding L-5) — this was
  // previously an unchecked assumption, storing whatever role the wire
  // carried in that position. Asserted again here, not just documented,
  // since persistTurn's own contract depends on it regardless of what its
  // one current caller happens to guarantee.
  const newUser = input.messages[input.messages.length - 1];
  if (newUser.role !== "user") {
    throw new Error("persistTurn: last message must be role 'user'");
  }
  // Never store a reply the request contract couldn't accept back: it would be
  // replayed on the next turn and fail validation, which is exactly how a chat
  // used to die permanently (QA finding F-2). The provider's own max_tokens
  // keeps real replies far below this, so it only ever fires for a BYOK custom
  // endpoint that ignores it — in which case a truncated stored reply beats an
  // unusable chat. The client keeps the untruncated text it already rendered.
  const storedReply = truncate(reply, MAX_ASSISTANT_MESSAGE_CHARS);
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
      content: storedReply,
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
