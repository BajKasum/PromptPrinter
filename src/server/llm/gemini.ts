import "server-only";

import { GoogleGenAI } from "@google/genai";
import { GEMINI_NO_RETRY } from "@/server/llm/config";
import { toGeminiContents } from "@/server/llm/messages";
import {
  LlmEmptyReplyError,
  type AnalysisImage,
  type AnalysisResult,
  type LlmMessage,
  type LlmResult,
} from "@/server/llm/types";

// Gemini: Server-Zweitanbieter, Failover und BYOK. (Teil von src/server/llm/, siehe index.ts)

// ─── Gemini (secondary provider, and a BYOK choice) ─────────────────────────

export async function geminiComplete(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string
): Promise<LlmResult> {
  const ai = new GoogleGenAI({ apiKey, ...GEMINI_NO_RETRY });
  const res = await ai.models.generateContent({
    model,
    contents: toGeminiContents(messages),
    config: { systemInstruction: system, maxOutputTokens },
  });

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

export async function* geminiCompleteStream(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey, ...GEMINI_NO_RETRY });
  const stream = await ai.models.generateContentStream({
    model,
    contents: toGeminiContents(messages),
    config: { systemInstruction: system, maxOutputTokens, abortSignal: signal },
  });
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}

export async function geminiAnalyze(
  model: string,
  system: string,
  text: string,
  images: AnalysisImage[],
  maxOutputTokens: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey, ...GEMINI_NO_RETRY });
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

  const reply = res.text?.trim() ?? "";
  if (!reply) throw new LlmEmptyReplyError("Gemini");

  const meta = res.usageMetadata;
  const usage =
    meta && typeof meta.promptTokenCount === "number" && typeof meta.candidatesTokenCount === "number"
      ? { inputTokens: meta.promptTokenCount, outputTokens: meta.candidatesTokenCount }
      : null;

  return { text: reply, usage, model };
}
