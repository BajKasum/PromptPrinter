import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { problem } from "@/server/http/api-problem";
import { readJsonBody, RequestBodyTooLargeError } from "@/server/http/request-body";
import { createClient } from "@/server/supabase/server";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import { denied } from "@/server/security/security-log";
import { reserveModelCall } from "@/server/model-call";
import { chatCompleteStream, classifyLlmFailure, llmConfig, LlmEmptyReplyError } from "@/server/llm";
import { requestT } from "@/server/i18n";
import { describeLlmFailure } from "@/features/chat/lib/turn-failures";
import { captureError, logEvent } from "@/shared/lib/observability";
import { TEST_RUN_MAX_BODY_BYTES, TEST_RUN_MAX_OUTPUT_TOKENS, TEST_RUN_SYSTEM, testRunRequestSchema } from "@/shared/lib/test-run";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Probelauf: schickt einen fertigen Prompt einmal unverändert an das Modell der Person und gibt die Antwort zurück,
 * damit sie sieht, was eine KI daraus macht. Ohne Finns Systemprompt (nur der neutrale Satz TEST_RUN_SYSTEM, den
 * Anthropic braucht, weil ein leerer Systemtext abgelehnt wird), mit begrenzter Ausgabe, nicht gespeichert.
 *
 * Dieselbe Kostenkette wie der Chat (server/model-call.ts): eigener Key, sonst Server-Key im Kontingent oder im
 * Gratis-Rahmen, dort höchstens ein Probelauf je Prompt, der nicht als Gratis-Prompt zählt, aber gegen das
 * Gratis-Tagesbudget. Nur mit Sitzung im Browser (Cookie), kein Bearer.
 */
export async function POST(req: Request): Promise<Response> {
  const m = requestT(req).t.api;
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return problem(503, m.chatUnavailable);
  }
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return denied("test-run", problem(401, m.signInToChat));

  let body: unknown;
  try {
    body = await readJsonBody(req, TEST_RUN_MAX_BODY_BYTES);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) return problem(413, m.testRunTooLong);
    return problem(400, m.unreadableReload);
  }
  const parsed = testRunRequestSchema.safeParse(body);
  if (!parsed.success) return problem(400, m.testRunTooLong);
  const { prompt } = parsed.data;

  const allowance = await reserveModelCall({
    supabase,
    userId: user.id,
    appMetadata: user.app_metadata,
    m,
    checkHourlyLimit: () => rateLimit(rateLimitKey(req, "test-run", user.id), { limit: 30, windowMs: 60 * 60 * 1000 }),
    texts: {
      monthlyLimit: m.chatLimit,
      tooMany: m.tooManyRequests,
      budget: m.chatBudget,
      notConfigured: m.chatNotConfigured,
      unavailable: m.chatUnavailable,
    },
    // Ein Probelauf gegen den Platzhalter wäre eine erfundene Antwort, die wie eine echte aussieht.
    stubOutsideProduction: false,
    freeTrial: {
      req,
      budget: m.freeTrialBudget,
      testRunOf: { promptHash: createHash("sha256").update(prompt).digest("hex").slice(0, 32), used: m.testRunUsed },
    },
  });
  if (allowance instanceof Response) return allowance;
  const { override, releaseReservations } = allowance;

  const startedAt = Date.now();
  let reply = "";
  try {
    for await (const chunk of chatCompleteStream({
      system: TEST_RUN_SYSTEM,
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: TEST_RUN_MAX_OUTPUT_TOKENS,
      override: override ?? undefined,
      signal: req.signal,
    })) {
      reply += chunk;
    }
    if (!reply.trim()) throw new LlmEmptyReplyError(override?.provider ?? llmConfig()?.provider ?? "provider");
  } catch (err) {
    // Bricht der Browser ab, nachdem schon Text kam, sind die Token bezahlt: die Reservierungen bleiben stehen, wie bei
    // finishAborted im Chat (api/chat/reply-stream.ts). Sonst liesse sich jeder Probelauf kurz vor dem Ende abbrechen
    // und kostete keinen Platz in den Grenzen je Konto, Adresse und Tag.
    if (req.signal.aborted) {
      if (!reply.trim()) await releaseReservations();
      return new Response(null, { status: 499 });
    }
    await releaseReservations();
    captureError("test_run.failed", err, { userId: user.id, byok: Boolean(override) });
    return problem(502, describeLlmFailure(classifyLlmFailure(err), m));
  }

  logEvent("test_run", {
    userId: user.id,
    byok: Boolean(override),
    freeTrial: Boolean(allowance.freeTrial),
    promptChars: prompt.length,
    replyChars: reply.length,
    latencyMs: Date.now() - startedAt,
  });
  return NextResponse.json(
    { reply },
    // KI-erzeugt (shared/lib/ai-marker.ts), wie der Strom des Chats.
    { headers: { "cache-control": "no-store", "x-ai-generated": "true" } }
  );
}
