import "server-only";

import type { createClient } from "@/server/supabase/server";
import { orThrow } from "@/server/supabase/query";
import { isSavedPromptId } from "@/shared/lib/start-from-prompt";
import type { VersionTarget } from "@/shared/lib/prompt-versions";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Der gespeicherte Prompt, von dem Speichern in diesem Chat eine neue Version anbietet, sonst null: zuerst der zuletzt
 * aus diesem Chat gespeicherte (`saved_prompts.conversation_id`), sonst der Ursprung des Chats aus "Als Ausgangspunkt
 * nutzen" (`conversations.source_prompt_id`), und für einen neuen Chat, der noch keine ID hat, der Prompt aus `?from=`.
 * Gelesen wird mit der Sitzung (RLS) und zusätzlich nur Zeilen des Kontos (`user_id`); eine fremde oder unsinnige ID
 * ergibt still null.
 */
export async function loadVersionTarget(
  supabase: ServerClient,
  userId: string,
  { conversationId, from }: { conversationId?: string | null; from?: unknown }
): Promise<VersionTarget | null> {
  let promptId: string | null = isSavedPromptId(from) ? from : null;

  if (conversationId) {
    const { data: latest } = orThrow(
      await supabase
        .from("saved_prompts")
        .select("id, outputs")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      "saved_prompts"
    );
    if (latest) return toTarget(latest.id, latest.outputs);

    const { data: chat } = orThrow(
      await supabase
        .from("conversations")
        .select("source_prompt_id")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .maybeSingle(),
      "conversations"
    );
    promptId = chat?.source_prompt_id ?? null;
  }

  if (!promptId) return null;
  const { data: source } = orThrow(
    await supabase.from("saved_prompts").select("id, outputs").eq("id", promptId).eq("user_id", userId).maybeSingle(),
    "saved_prompts"
  );
  return source ? toTarget(source.id, source.outputs) : null;
}

function toTarget(id: string, outputs: unknown): VersionTarget | null {
  const o = (outputs ?? {}) as { prompt?: unknown; title?: unknown };
  if (typeof o.prompt !== "string" || !o.prompt.trim()) return null;
  return { id, prompt: o.prompt, title: typeof o.title === "string" ? o.title : "" };
}
