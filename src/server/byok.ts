import "server-only";

import { decrypt, encrypt } from "@/server/security/crypto";
import { createAdminClient } from "@/server/supabase/admin";
import { orThrow } from "@/server/supabase/query";
import { captureError } from "@/shared/lib/observability";
import type { createClient } from "@/server/supabase/server";
import type { ByokProvider, LlmOverride } from "@/server/llm";
import type { CustomProviderMeta } from "@/shared/lib/byok-types";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/** Wofür ein Key gespeichert wird: ein benannter Anbieter oder ein eigener Endpunkt mit Name, Adresse und Modell. */
export type ByokTarget =
  | { provider: "anthropic" | "openai" | "gemini" }
  | { provider: "custom"; label: string; baseUrl: string; model: string };

/** Eine Zeile für user_api_keys. Immer alle Spalten: bei einem benannten Anbieter stehen die des Endpunkts auf null. */
export type ByokRow = {
  user_id: string;
  provider: ByokTarget["provider"];
  encrypted_key: string;
  label: string | null;
  base_url: string | null;
  model: string | null;
};

/** Verschlüsselt den Key für genau diese Zeile. Wirft ohne API_KEY_ENCRYPTION_SECRET (server/security/crypto.ts). */
export function byokRow(userId: string, apiKey: string, target: ByokTarget): ByokRow {
  const custom = target.provider === "custom" ? target : null;
  return {
    user_id: userId,
    provider: target.provider,
    encrypted_key: encrypt(apiKey, { userId, provider: target.provider }),
    label: custom?.label ?? null,
    base_url: custom?.baseUrl ?? null,
    model: custom?.model ?? null,
  };
}

/**
 * Geschrieben wird user_api_keys nur hier, mit dem Service-Role-Schlüssel (Migration 0060 entzieht authenticated die
 * Schreibrechte): sonst liessen sich der zweite Faktor und der Probeaufruf von api/settings/api-key über die Data API
 * umgehen, etwa base_url eines custom-Keys auf einen fremden Host setzen. Der Schlüssel umgeht RLS, deshalb steht die
 * user_id der geprüften Sitzung in jeder Zeile und in jedem Filter. Fehlt er, kommt ein Fehler zurück wie von der
 * Datenbank, und die Route antwortet 500 statt mit der Sitzung zu schreiben.
 */
async function writeAsServer(
  write: (admin: ReturnType<typeof createAdminClient>) => PromiseLike<{ error: unknown }>
): Promise<{ error: unknown }> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    return { error: err };
  }
  const { error } = await write(admin);
  return { error };
}

/** Legt den Key an oder ersetzt ihn: je Konto und Anbieter eine Zeile. */
export function saveByokRow(row: ByokRow): Promise<{ error: unknown }> {
  return writeAsServer((admin) => admin.from("user_api_keys").upsert(row, { onConflict: "user_id,provider" }));
}

/** Macht den Key dieses Anbieters aktiv und alle anderen des Kontos inaktiv, in einer Anweisung (Migration 0059). */
export function activateByokProvider(userId: string, provider: string): Promise<{ error: unknown }> {
  return writeAsServer((admin) =>
    admin.rpc("set_active_byok_provider_for", { target_user: userId, target_provider: provider })
  );
}

/** Entfernt den Key dieses Anbieters; ist er der aktive, macht der Trigger aus 0030 den nächsten aktiv. */
export function removeByokRow(userId: string, provider: string): Promise<{ error: unknown }> {
  return writeAsServer((admin) => admin.from("user_api_keys").delete().eq("user_id", userId).eq("provider", provider));
}

/**
 * A signed-in user's stored BYOK key, ready to pass as chatComplete's
 * `override`, or null if they haven't configured one.
 *
 * "unreadable" heisst: es gibt eine Zeile, aber sie lässt sich nicht verwenden (falsches
 * API_KEY_ENCRYPTION_SECRET, Rotation ohne PREVIOUS, kaputte Zeile). Die Aufrufer lehnen dann
 * mit einer eigenen Meldung ab und fallen bewusst nicht auf den Server-Key zurück: das Konto hat
 * einen eigenen Key gewählt, und ein stiller Wechsel fiele erst auf der Rechnung auf.
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
export async function getUserOverride(userId: string): Promise<LlmOverride | null | "unreadable"> {
  // Ein Lesefehler ist NICHT "kein eigener Key": der Zug liefe sonst auf dem Server-Key (Kosten beim Betreiber) oder würde
  // abgelehnt. Er wirft DatabaseReadError, der Aufrufer antwortet mit 503.
  const { data } = orThrow(
    await createAdminClient()
      .from("user_api_keys")
      .select("provider, encrypted_key, base_url, model")
      .eq("user_id", userId)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    "user_api_keys"
  );
  if (!data) return null;

  const provider = data.provider as ByokProvider;
  try {
    const apiKey = decrypt(data.encrypted_key as string, { userId, provider });
    if (provider === "custom") {
      const baseUrl = data.base_url as string | null;
      const model = data.model as string | null;
      // The DB constraint guarantees these alongside provider='custom'; a
      // null here means the row is inconsistent.
      if (!baseUrl || !model) throw new Error("custom row without base_url or model");
      return { provider: "custom", apiKey, baseUrl, model };
    }
    return { provider, apiKey };
  } catch (err) {
    captureError("byok.key_unreadable", err, { userId, provider });
    return "unreadable";
  }
}

/** Which BYOK providers this user has configured, for the settings UI. */
export async function getConfiguredProviders(
  supabase: SupabaseServerClient,
  userId: string
): Promise<ByokProvider[]> {
  const { data } = orThrow(
    await supabase.from("user_api_keys").select("provider").eq("user_id", userId),
    "user_api_keys"
  );
  return (data ?? []).map((r) => r.provider as ByokProvider);
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
  const { data } = orThrow(
    await supabase
    .from("user_api_keys")
    .select("provider")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle(),
    "user_api_keys"
  );
  return (data?.provider as ByokProvider | undefined) ?? null;
}

export type { CustomProviderMeta } from "@/shared/lib/byok-types";

/** The user's custom-endpoint BYOK config (no key), for the settings UI. */
export async function getCustomProvider(
  supabase: SupabaseServerClient,
  userId: string
): Promise<CustomProviderMeta | null> {
  const { data } = orThrow(
    await supabase
    .from("user_api_keys")
    .select("label, base_url, model")
    .eq("user_id", userId)
    .eq("provider", "custom")
    .maybeSingle(),
    "user_api_keys"
  );
  if (!data?.label || !data.base_url || !data.model) return null;
  return { label: data.label as string, baseUrl: data.base_url as string, model: data.model as string };
}
