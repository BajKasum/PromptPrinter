import { decrypt } from "@/lib/crypto";
import type { createClient } from "@/lib/supabase/server";
import type { ByokProvider, LlmOverride } from "@/lib/llm";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/**
 * A signed-in user's stored BYOK key, ready to pass as chatComplete's
 * `override` — or null if they haven't configured one (or a stored row
 * fails to decrypt, which degrades to "no override" rather than a hard
 * failure, since /api/chat and /api/generate both have a working fallback:
 * the server's own configured provider).
 */
export async function getUserOverride(
  supabase: SupabaseServerClient,
  userId: string
): Promise<LlmOverride | null> {
  const { data } = await supabase
    .from("user_api_keys")
    .select("provider, encrypted_key")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  try {
    return {
      provider: data.provider as ByokProvider,
      apiKey: decrypt(data.encrypted_key as string),
    };
  } catch {
    return null;
  }
}

/** Which BYOK providers this user has configured — for the settings UI. */
export async function getConfiguredProviders(
  supabase: SupabaseServerClient,
  userId: string
): Promise<ByokProvider[]> {
  const { data } = await supabase.from("user_api_keys").select("provider").eq("user_id", userId);
  return ((data ?? []) as { provider: ByokProvider }[]).map((r) => r.provider);
}
