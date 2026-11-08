import "server-only";

import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/server/supabase/admin";
import { orThrow } from "@/server/supabase/query";

// Einen gespeicherten Prompt per Link teilen (Tabelle prompt_shares, Migration 0057). Das Token ist 24 Zufallsbytes in
// base64url, 32 Zeichen, so wie es die Prüfung in der Datenbank verlangt. Geschrieben und gelesen wird nur hier, mit
// der Service-Role: die öffentliche Seite /geteilt/<token> hat keine Sitzung, und `anon` hat keine Rechte auf der
// Tabelle. Sie bekommt nur Titel und Text, nie etwas über die Person dahinter.

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function newShareToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Nur was wie ein Token aussieht, geht überhaupt an die Datenbank. */
export function isShareToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

export type SharedPrompt = { title: string; content: string; sharedAt: string };

/** Titel und Text des geteilten Prompts, oder null (kein Token dieser Form, widerrufen, gelöscht). */
export async function loadSharedPrompt(token: string): Promise<SharedPrompt | null> {
  if (!isShareToken(token)) return null;
  const { data } = orThrow(
    await createAdminClient()
      .from("prompt_shares")
      .select("created_at, saved_prompts(outputs)")
      .eq("token", token)
      .maybeSingle(),
    "prompt_shares"
  );
  const outputs = data?.saved_prompts?.outputs as { prompt?: unknown; title?: unknown } | null | undefined;
  if (!data || !outputs || typeof outputs.prompt !== "string" || !outputs.prompt.trim()) return null;
  return {
    title: typeof outputs.title === "string" && outputs.title.trim() ? outputs.title.trim() : "",
    content: outputs.prompt,
    sharedAt: data.created_at,
  };
}

/** Das Token einer Freigabe des Kontos für diesen Prompt, oder null. */
export async function shareTokenFor(userId: string, promptId: string): Promise<string | null> {
  const { data } = orThrow(
    await createAdminClient()
      .from("prompt_shares")
      .select("token")
      .eq("prompt_id", promptId)
      .eq("user_id", userId)
      .maybeSingle(),
    "prompt_shares"
  );
  return data?.token ?? null;
}

/**
 * Gibt den Prompt frei und liefert das Token (`created`: neu angelegt); ist er schon freigegeben, dasselbe Token. Der
 * zusammengesetzte Fremdschlüssel in der Datenbank lässt nur den Eigentümer des Prompts zu.
 */
export async function createShare(userId: string, promptId: string): Promise<{ token: string; created: boolean }> {
  const existing = await shareTokenFor(userId, promptId);
  if (existing) return { token: existing, created: false };
  const token = newShareToken();
  const { error } = await createAdminClient()
    .from("prompt_shares")
    .insert({ token, prompt_id: promptId, user_id: userId });
  if (error) {
    // Zwei Klicks gleichzeitig: der zweite trifft auf die Eindeutigkeit von prompt_id und nimmt das Token des ersten.
    if (error.code === "23505") {
      const raced = await shareTokenFor(userId, promptId);
      if (raced) return { token: raced, created: false };
    }
    throw error;
  }
  return { token, created: true };
}

/** Widerruft die Freigabe; der Link führt danach ins Leere. Gibt zurück, ob es eine gab. */
export async function revokeShare(userId: string, promptId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("prompt_shares")
    .delete()
    .eq("prompt_id", promptId)
    .eq("user_id", userId)
    .select("token");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
