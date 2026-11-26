import "server-only";

import { LlmBlockedError, LlmReportedError } from "@/server/llm/types";

// Warum eine Antwort endet. Jeder Anbieter nennt es anders, daraus folgt immer eines: Sie ist fertig, sie ist nicht zu
// Ende (der Nutzer sieht das an ihr), oder der Anbieter hat sie gestoppt (Inhaltsfilter, Fehler), dann geht sie wie ein
// Fehler. (Teil von src/server/llm/, siehe index.ts)

export type Finish = "complete" | "truncated" | "blocked" | "failed";

// `finish_reason` in der Form von OpenAI (OpenAI, Z.ai, eigene Endpunkte). Z.ai dokumentiert `sensitive`,
// `model_context_window_exceeded` und `network_error`, OpenRouter meldet `error`, DeepSeek
// `insufficient_system_resource`, Mistral `model_length`.
const OPENAI_REASONS = new Map<string, Finish>([
  ["length", "truncated"],
  ["max_tokens", "truncated"],
  ["model_length", "truncated"],
  ["model_context_window_exceeded", "truncated"],
  ["content_filter", "blocked"],
  ["sensitive", "blocked"],
  ["error", "failed"],
  ["network_error", "failed"],
  ["insufficient_system_resource", "failed"],
]);

/** Ausfälle beim Anbieter: vorübergehend, also wie ein 503 (neuer Versuch vor dem ersten Wort, Failover). */
const OUTAGES = new Set(["network_error", "insufficient_system_resource"]);

const ANTHROPIC_REASONS = new Map<string, Finish>([
  ["max_tokens", "truncated"],
  ["model_context_window_exceeded", "truncated"],
  ["refusal", "blocked"],
]);

const GEMINI_FILTERS = new Set([
  "SAFETY",
  "RECITATION",
  "LANGUAGE",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "IMAGE_SAFETY",
  "IMAGE_PROHIBITED_CONTENT",
  "IMAGE_RECITATION",
  "MODEL_ARMOR",
]);

/** Ein unbekannter Wert zählt als fertig: ein eigener Server darf das normale Ende nennen, wie er will (`eos`). */
export function openAiFinish(reason: string): Finish {
  return OPENAI_REASONS.get(reason.toLowerCase()) ?? "complete";
}

/** `stop_reason` von Anthropic (`end_turn`, `stop_sequence`, ... zählen als fertig). */
export function anthropicFinish(reason: string): Finish {
  return ANTHROPIC_REASONS.get(reason) ?? "complete";
}

/** `finishReason` von Gemini: nur `STOP` ist ein fertiges Ende, alles ausser den Filtern heisst abgeschnitten. */
export function geminiFinish(reason: string): Finish {
  if (reason === "STOP") return "complete";
  return GEMINI_FILTERS.has(reason) ? "blocked" : "truncated";
}

/** Wirft, wenn der Anbieter die Antwort gestoppt hat; sonst sagt der Rückgabewert, ob sie abgeschnitten ist. */
export function cutOffByReason(finish: Finish, provider: string, reason: string): boolean {
  if (finish === "blocked") throw new LlmBlockedError(provider, reason);
  if (finish === "failed") {
    throw new LlmReportedError(provider, `finish_reason ${reason}`, OUTAGES.has(reason.toLowerCase()) ? 503 : undefined);
  }
  return finish === "truncated";
}
