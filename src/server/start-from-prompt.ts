import "server-only";

import type { createClient } from "@/server/supabase/server";
import { orThrow } from "@/server/supabase/query";
import { isSavedPromptId } from "@/shared/lib/start-from-prompt";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Der Text eines eigenen gespeicherten Prompts für `?from=<id>` (shared/lib/start-from-prompt.ts), sonst null. Gelesen
 * wird mit der Sitzung (RLS) und zusätzlich nur Zeilen des Kontos (`user_id`). Eine fremde, gelöschte oder unsinnige ID
 * ergibt still null: die Seite startet ohne Vorbelegung und verrät nicht, ob es die ID gibt.
 */
export async function loadStartPrompt(supabase: ServerClient, userId: string, from: unknown): Promise<string | null> {
  if (!isSavedPromptId(from)) return null;
  const { data } = orThrow(
    await supabase.from("saved_prompts").select("outputs").eq("id", from).eq("user_id", userId).maybeSingle(),
    "saved_prompts"
  );
  const outputs = data?.outputs as { prompt?: unknown } | null | undefined;
  return outputs && typeof outputs.prompt === "string" && outputs.prompt.trim() ? outputs.prompt : null;
}
