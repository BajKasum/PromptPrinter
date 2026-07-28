import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { chatComplete, type LlmOverride } from "@/lib/llm";
import { encrypt } from "@/lib/crypto";
import { problem } from "@/lib/api-problem";

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

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problem(400, "Invalid JSON body");
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return problem(400, "Invalid request", {
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const { provider, apiKey } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Anmeldung erforderlich.");

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
    return problem(500, `Key konnte nicht gespeichert werden: ${error.message}`);
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

  const { error } = await supabase
    .from("user_api_keys")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);
  if (error) {
    return problem(500, `Key konnte nicht entfernt werden: ${error.message}`);
  }

  return NextResponse.json({ ok: true });
}
