import "server-only";

import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import { GEMINI_API_VERSION, GEMINI_NO_RETRY } from "@/server/llm/config";
import { cutOffByReason, geminiFinish } from "@/server/llm/finish";
import { toGeminiContents } from "@/server/llm/messages";
import {
  LlmBlockedError,
  LlmEmptyReplyError,
  type AnalysisResult,
  type LlmResult,
  type ProviderAnalyzeCall,
  type ProviderChatCall,
  type ProviderStreamCall,
} from "@/server/llm/types";

// Gemini: Server-Zweitanbieter, Failover und BYOK. (Teil von src/server/llm/, siehe index.ts)

// ─── Gemini (secondary provider, and a BYOK choice) ─────────────────────────

/** Ein Client je Aufruf: feste API-Version, keine Wiederholung im SDK (siehe config.ts). */
function geminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey, apiVersion: GEMINI_API_VERSION, ...GEMINI_NO_RETRY });
}

/**
 * Was eine Antwort (oder ein Stück davon) über ihr Ende sagt: eine abgelehnte Anfrage oder ein Filter werfen
 * (finish.ts). Sonst ob sie abgeschnitten ist, oder undefined, solange noch kein Abschlussgrund da ist.
 */
function geminiEnd(res: Pick<GenerateContentResponse, "promptFeedback" | "candidates">): boolean | undefined {
  const blocked = res.promptFeedback?.blockReason;
  if (blocked && blocked !== "BLOCKED_REASON_UNSPECIFIED") throw new LlmBlockedError("Gemini", blocked);
  const reason = res.candidates?.[0]?.finishReason;
  if (!reason || reason === "FINISH_REASON_UNSPECIFIED") return undefined;
  return cutOffByReason(geminiFinish(reason), "Gemini", reason);
}

export async function geminiComplete({
  model,
  system,
  messages,
  maxOutputTokens,
  apiKey,
}: ProviderChatCall): Promise<LlmResult> {
  const ai = geminiClient(apiKey);
  const res = await ai.models.generateContent({
    model,
    contents: toGeminiContents(messages),
    config: { systemInstruction: system, maxOutputTokens },
  });
  geminiEnd(res);

  // `text` is undefined when the response was blocked or fully consumed by
  // thinking, treat as empty and let the caller degrade.
  const text = res.text?.trim() ?? "";
  if (!text) throw new LlmEmptyReplyError("Gemini");

  const meta = res.usageMetadata;
  const usage =
    meta && typeof meta.promptTokenCount === "number" && typeof meta.candidatesTokenCount === "number"
      ? { inputTokens: meta.promptTokenCount, outputTokens: meta.candidatesTokenCount }
      : null;

  return { text, usage };
}

export async function* geminiCompleteStream({
  model,
  system,
  messages,
  maxOutputTokens,
  apiKey,
  signal,
  onTruncated,
}: ProviderStreamCall): AsyncGenerator<string> {
  const ai = geminiClient(apiKey);
  const stream = await ai.models.generateContentStream({
    model,
    contents: toGeminiContents(messages),
    config: { systemInstruction: system, maxOutputTokens, abortSignal: signal },
  });
  // Endet der Strom ohne Abschlussgrund, ist die Antwort nicht zu Ende.
  let cutOff = true;
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
    cutOff = geminiEnd(chunk) ?? cutOff;
  }
  if (cutOff) onTruncated?.();
}

export async function geminiAnalyze({
  model,
  system,
  text,
  images,
  maxOutputTokens,
  apiKey,
  signal,
}: ProviderAnalyzeCall): Promise<AnalysisResult> {
  const ai = geminiClient(apiKey);
  const res = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text },
          ...images.map((image) => ({
            inlineData: { mimeType: image.mediaType, data: image.base64 },
          })),
        ],
      },
    ],
    config: { systemInstruction: system, maxOutputTokens, abortSignal: signal },
  });
  geminiEnd(res);

  const reply = res.text?.trim() ?? "";
  if (!reply) throw new LlmEmptyReplyError("Gemini");

  const meta = res.usageMetadata;
  const usage =
    meta && typeof meta.promptTokenCount === "number" && typeof meta.candidatesTokenCount === "number"
      ? { inputTokens: meta.promptTokenCount, outputTokens: meta.candidatesTokenCount }
      : null;

  return { text: reply, usage, model };
}
