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
 *
 * Security-Audit finding M-6: this used to take whichever key was created
 * FIRST (`order("created_at").limit(1)`), while the settings UI listed every
 * configured provider as connected — so a user with two keys had one silently
 * ignored, with no way to tell which. `is_active` (migration 0030) makes that
 * an explicit, user-owned choice, and a partial unique index guarantees at most
 * one per user. The created_at tiebreak is kept purely as a safety net for a
 * row set that somehow has none active; it can only be reached if the
 * migration's backfill and the delete-promotion trigger both failed to apply.
 */
export async function getUserOverride(userId: string): Promise<LlmOverride | null> {
  const { data } = await createAdminClient()
    .from("user_api_keys")
    .select("provider, encrypted_key, base_url, model")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
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

/**
 * The provider whose key actually runs this user's chats, or null when they
 * have none configured (Security-Audit finding M-6).
 *
 * Exists so the settings UI can state which of several connected keys is in
 * use, instead of showing all of them as equally "connected" while one silently
 * wins. Reads `is_active` through the request-scoped client — that column is in
 * `authenticated`'s SELECT allowlist (0020/0030), unlike `encrypted_key`.
 */
export async function getActiveProvider(
  supabase: SupabaseServerClient,
  userId: string
): Promise<ByokProvider | null> {
  const { data } = await supabase
    .from("user_api_keys")
    .select("provider")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return (data?.provider as ByokProvider | undefined) ?? null;
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
