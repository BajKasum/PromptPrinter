import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { createClient } from "@/server/supabase/server";
import { chatComplete, type LlmOverride } from "@/server/llm";
import { encrypt } from "@/server/security/crypto";
import { problem } from "@/server/http/api-problem";
import { captureError } from "@/shared/lib/observability";
import {
  MAX_SMALL_BODY_BYTES,
  RequestBodyTooLargeError,
  readJsonBody,
} from "@/server/http/request-body";

export const runtime = "nodejs";

// Settings → "Eigene API-Keys" (BYOK). Save/remove a user's own Anthropic/
// OpenAI/Gemini key, or a generic 'custom' OpenAI-compatible endpoint (Z.ai,
// DeepSeek, Groq, OpenRouter, …), so their chats and generations run against
// their own account instead of the server's Z.ai default (see lib/llm.ts's
// LlmOverride, and buildOverride() in api/chat + api/generate). The key is
// test-called once before it's ever encrypted and stored, so a typo or a
// revoked key fails here with a clear message instead of silently at the
// user's next generation.

const NAMED_PROVIDERS = ["anthropic", "openai", "gemini"] as const;
const PROVIDERS = [...NAMED_PROVIDERS, "custom"] as const;

const saveSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.enum(NAMED_PROVIDERS),
    apiKey: z.string().trim().min(1, "Key darf nicht leer sein").max(300),
  }),
  z.object({
    provider: z.literal("custom"),
    apiKey: z.string().trim().min(1, "Key darf nicht leer sein").max(300),
    label: z.string().trim().min(1, "Name darf nicht leer sein").max(60),
    baseUrl: z.string().trim().url("Muss eine gültige URL sein").max(300),
    model: z.string().trim().min(1, "Modell darf nicht leer sein").max(100),
  }),
]);

const activateSchema = z.object({ provider: z.enum(PROVIDERS) });

export async function POST(req: Request) {
  // Session first, body second (Security-Audit finding H-3): parsing before
  // authenticating let an unauthenticated caller make the server read and parse
  // an unbounded payload just to be told 401. Doubly worth it here — the body
  // carries a plaintext API key, so the less that happens with it before the
  // caller is known, the better.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Anmeldung erforderlich.");

  let body: unknown;
  try {
    body = await readJsonBody(req, MAX_SMALL_BODY_BYTES);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) {
      return problem(413, "Die Anfrage ist zu gross.");
    }
    return problem(400, "Invalid JSON body");
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return problem(400, "Invalid request", {
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const { provider, apiKey } = parsed.data;

  // Admin exemption mirrors /api/chat, /api/projects and /api/account:
  // a single is_admin lookup gates whether the hourly limit below applies.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!(profile?.is_admin ?? false)) {
    const rl = await rateLimit(rateLimitKey(req, user.id), { limit: 30, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) {
      return problem(429, "Zu viele Anfragen, bitte warte kurz und versuch es erneut.", {
        retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
      });
    }
  }

  const override: LlmOverride =
    provider === "custom"
      ? { provider, apiKey, baseUrl: parsed.data.baseUrl, model: parsed.data.model }
      : { provider, apiKey };

  // Test the key against its real provider before it's ever persisted, a
  // bad key should fail loudly right here, not silently at generation time.
  //
  // QA finding U-4: /api/chat stopped surfacing raw provider error text to
  // the client (see classifyLlmFailure/describeLlmFailure in llm.ts / that
  // route). This is the one deliberate exception: the person reading this
  // message is the key's own owner, mid-setup, deciding whether the key they
  // just typed is good — "invalid_api_key" or "model not found" is exactly
  // the actionable detail they need, and there's no different user it could
  // leak to. Nothing else in the app reuses this path.
  try {
    await chatComplete({
      system: "Antworte ausschliesslich mit dem einen Wort OK.",
      messages: [{ role: "user", content: "Test." }],
      maxOutputTokens: 10,
      override,
    });
  } catch (err) {
    return problem(
      400,
      `Key konnte nicht bestätigt werden: ${err instanceof Error ? err.message : "unbekannter Fehler"}`
    );
  }

  // Same shape either way (nulling the custom-only columns for named
  // providers), the explicit type keeps this one concrete row type instead
  // of a union the client's upsert typing can't resolve.
  type UserApiKeyRow = {
    user_id: string;
    provider: "anthropic" | "openai" | "gemini" | "custom";
    encrypted_key: string;
    label: string | null;
    base_url: string | null;
    model: string | null;
  };
  const row: UserApiKeyRow =
    provider === "custom"
      ? {
          user_id: user.id,
          provider,
          encrypted_key: encrypt(apiKey),
          label: parsed.data.label,
          base_url: parsed.data.baseUrl,
          model: parsed.data.model,
        }
      : {
          user_id: user.id,
          provider,
          encrypted_key: encrypt(apiKey),
          label: null,
          base_url: null,
          model: null,
        };

  const { error } = await supabase
    .from("user_api_keys")
    .upsert(row, { onConflict: "user_id,provider" });
  if (error) {
    // Generic to the client, detailed to the logs (Security-Audit finding
    // M-1). Note the contrast with the test-call above: that one deliberately
    // surfaces the provider's own message because it is the key owner's only
    // way to tell a typo from a revoked key. This one is OUR database talking,
    // and its message names constraints and columns — nothing the user can act
    // on, everything an attacker would like to know.
    captureError("api_key.save_failed", error, { userId: user.id, provider });
    return problem(500, "Key konnte nicht gespeichert werden. Bitte versuch es erneut.");
  }

  // A first key has to become the active one, or it would be stored and then
  // ignored — the exact silence Security-Audit finding M-6 is about. Later keys
  // deliberately do NOT steal the slot: switching is the user's call (PATCH
  // below), so connecting a second provider never changes which key is billed
  // without them asking for it.
  const { data: active } = await supabase
    .from("user_api_keys")
    .select("provider")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!active) {
    const { error: activateError } = await supabase.rpc("set_active_byok_provider", {
      target_provider: provider,
    });
    if (activateError) {
      captureError("api_key.activate_failed", activateError, { userId: user.id, provider });
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * Switch which stored key actually runs this user's chats (Security-Audit
 * finding M-6).
 *
 * Goes through the set_active_byok_provider RPC rather than two client updates:
 * clearing the old flag and setting the new one has to be one statement, or a
 * partial failure leaves the user with either no active key (silently back on
 * the server's provider and its plan limits) or two, which the partial unique
 * index rejects.
 */
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Anmeldung erforderlich.");

  // Security-Audit finding L-7: PATCH and DELETE on this route were the only
  // authenticated mutations in the project with no ceiling at all — POST
  // (saving a key) already rate-limits, switching/removing one didn't. Same
  // admin exemption and limit shape as POST; higher than POST's 30/hr since
  // neither of these calls out to a provider, but still bounded rather than
  // open.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!(profile?.is_admin ?? false)) {
    const rl = await rateLimit(rateLimitKey(req, user.id), { limit: 60, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) {
      return problem(429, "Zu viele Anfragen, bitte warte kurz und versuch es erneut.", {
        retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
      });
    }
  }

  let body: unknown;
  try {
    body = await readJsonBody(req, MAX_SMALL_BODY_BYTES);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) {
      return problem(413, "Die Anfrage ist zu gross.");
    }
    return problem(400, "Invalid JSON body");
  }

  const parsed = activateSchema.safeParse(body);
  if (!parsed.success) return problem(400, "Unbekannter Provider.");
  const { provider } = parsed.data;

  // Only a provider the user has actually stored may be activated. Without this
  // the RPC would happily set every row to is_active = false (nothing matches),
  // silently dropping them back to the server key.
  const { data: existing } = await supabase
    .from("user_api_keys")
    .select("provider")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .maybeSingle();
  if (!existing) return problem(404, "Für diesen Anbieter ist kein Key hinterlegt.");

  const { error } = await supabase.rpc("set_active_byok_provider", {
    target_provider: provider,
  });
  if (error) {
    captureError("api_key.activate_failed", error, { userId: user.id, provider });
    return problem(500, "Key konnte nicht aktiviert werden. Bitte versuch es erneut.");
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const provider = new URL(req.url).searchParams.get("provider");
  if (!provider || !PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) {
    return problem(400, "Unbekannter Provider.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Anmeldung erforderlich.");

  // Security-Audit finding L-7: the one unlimited authenticated mutation in
  // this route (and, before this, in the project) — see the same block on
  // PATCH above for the full reasoning.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!(profile?.is_admin ?? false)) {
    const rl = await rateLimit(rateLimitKey(req, user.id), { limit: 60, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) {
      return problem(429, "Zu viele Anfragen, bitte warte kurz und versuch es erneut.", {
        retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
      });
    }
  }

  const { error } = await supabase
    .from("user_api_keys")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);
  if (error) {
    captureError("api_key.delete_failed", error, { userId: user.id, provider });
    return problem(500, "Key konnte nicht entfernt werden. Bitte versuch es erneut.");
  }

  return NextResponse.json({ ok: true });
}
