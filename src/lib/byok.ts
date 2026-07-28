import { decrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { ByokProvider, LlmOverride } from "@/lib/llm";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/**
 * A signed-in user's stored BYOK key, ready to pass as chatComplete's
 * `override`, or null if they haven't configured one (or a stored row
 * fails to decrypt, which degrades to "no override" rather than a hard
 * failure, since /api/chat has a working fallback either way: the server's
 * own configured provider).
 *
 * QA finding S-3: `encrypted_key` used to be readable by the `authenticated`
 * role (a blanket table-level SELECT grant covered every column), which a
 * request-scoped client runs as — so the same read an ordinary signed-in
 * browser session could also have made. Migration 0020 revoked that column
 * from `authenticated`'s grant; this function now reads through the
 * service-role admin client instead (no request-scoped `supabase` param
 * anymore, it wouldn't be able to see `encrypted_key` either way), the one
 * place that legitimately needs the ciphertext. The owner condition stays an
 * explicit `.eq("user_id", userId)` rather than relying on RLS, since the
 * admin client bypasses RLS entirely (defense-in-depth, same principle as
 * every other user-scoped query in this project).
 */
export async function getUserOverride(userId: string): Promise<LlmOverride | null> {
  const { data } = await createAdminClient()
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
      // null here means something is inconsistent, degrade to "no override"
      // rather than crash the caller.
      if (!baseUrl || !model) return null;
      return { provider: "custom", apiKey, baseUrl, model };
    }
    return { provider, apiKey };
  } catch {
    return null;
  }
}

/** Which BYOK providers this user has configured, for the settings UI. */
export async function getConfiguredProviders(
  supabase: SupabaseServerClient,
  userId: string
): Promise<ByokProvider[]> {
  const { data } = await supabase.from("user_api_keys").select("provider").eq("user_id", userId);
  return ((data ?? []) as { provider: ByokProvider }[]).map((r) => r.provider);
}

export type CustomProviderMeta = { label: string; baseUrl: string; model: string };

/** The user's custom-endpoint BYOK config (no key), for the settings UI. */
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
