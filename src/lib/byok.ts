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
    .select("provider, encrypted_key, base_url, model")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  try {
    const apiKey = decrypt(data.encrypted_key as string);
    const provider = data.provider as ByokProvider;
    if (provider === "custom") {
      const baseUrl = data.base_url as string | null;
      const model = data.model as string | null;
      // The DB constraint guarantees these alongside provider='custom'; a
      // null here means something is inconsistent — degrade to "no override"
      // rather than crash the caller.
      if (!baseUrl || !model) return null;
      return { provider: "custom", apiKey, baseUrl, model };
    }
    return { provider, apiKey };
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

export type CustomProviderMeta = { label: string; baseUrl: string; model: string };

/** The user's custom-endpoint BYOK config (no key) — for the settings UI. */
export async function getCustomProvider(
  supabase: SupabaseServerClient,
  userId: string
): Promise<CustomProviderMeta | null> {
  const { data } = await supabase
    .from("user_api_keys")
    .select("label, base_url, model")
    .eq("user_id", userId)
    .eq("provider", "custom")
    .maybeSingle();
  if (!data?.label || !data.base_url || !data.model) return null;
  return { label: data.label as string, baseUrl: data.base_url as string, model: data.model as string };
}
