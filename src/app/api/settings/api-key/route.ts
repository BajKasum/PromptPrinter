import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { chatComplete, type ByokProvider } from "@/lib/llm";
import { encrypt } from "@/lib/crypto";

export const runtime = "nodejs";

// Settings → "Eigene API-Keys" (BYOK). Save/remove a user's own Anthropic/
// OpenAI/Gemini key so their chats and generations run against their own
// account instead of the server's Z.ai default (see lib/llm.ts's
// LlmOverride, and buildOverride() in api/chat + api/generate). The key is
// test-called once before it's ever encrypted and stored, so a typo or a
// revoked key fails here with a clear message instead of silently at the
// user's next generation.

const PROVIDERS = ["anthropic", "openai", "gemini"] as const;

const saveSchema = z.object({
  provider: z.enum(PROVIDERS),
  apiKey: z.string().trim().min(1, "Key darf nicht leer sein").max(300),
});

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

  const rl = await rateLimit(rateLimitKey(req, user.id), { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return problem(429, "Rate limit exceeded. Try again later.", {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  // Test the key against its real provider before it's ever persisted — a
  // bad key should fail loudly right here, not silently at generation time.
  try {
    await chatComplete({
      system: "Antworte ausschliesslich mit dem einen Wort OK.",
      messages: [{ role: "user", content: "Test." }],
      maxOutputTokens: 10,
      override: { provider: provider as ByokProvider, apiKey },
    });
  } catch (err) {
    return problem(
      400,
      `Key konnte nicht bestätigt werden: ${err instanceof Error ? err.message : "unbekannter Fehler"}`
    );
  }

  const { error } = await supabase.from("user_api_keys").upsert(
    { user_id: user.id, provider, encrypted_key: encrypt(apiKey) },
    { onConflict: "user_id,provider" }
  );
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

function problem(status: number, detail: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      type: "about:blank",
      title:
        status === 400
          ? "Bad Request"
          : status === 401
            ? "Unauthorized"
            : status === 429
              ? "Too Many Requests"
              : "Error",
      status,
      detail,
      ...extra,
    },
    { status, headers: { "content-type": "application/problem+json" } }
  );
}
