import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import type { AnalysisImage, LlmMessage } from "@/server/llm/types";

// Wie ein Verlauf für jeden Anbieter aussieht, einschließlich der Bilder.
// (Teil von src/server/llm/, siehe index.ts)

function imageDataUrl(image: AnalysisImage): string {
  return `data:${image.mediaType};base64,${image.base64}`;
}

/** Verlauf für Z.ai und den Custom-Slot (OpenAI-kompatibles JSON). */
export function toOpenAiMessages(system: string, messages: readonly LlmMessage[]) {
  return [
    { role: "system" as const, content: system },
    ...messages.map((m) => ({
      role: m.role,
      // Ohne Bilder die schlichte String-Form, siehe openAiParts.
      content: m.images?.length ? openAiParts(m.content, m.images) : m.content,
    })),
  ];
}

/** Verlauf für das OpenAI-SDK (streng typisiert, Bildteile nur an Nutzer-Nachrichten). */
export function toOpenAiSdkMessages(
  system: string,
  messages: readonly LlmMessage[]
): OpenAI.Chat.ChatCompletionMessageParam[] {
  return [
    { role: "system", content: system },
    ...messages.map((m): OpenAI.Chat.ChatCompletionMessageParam => {
      if (m.role === "user" && m.images?.length) {
        return {
          role: "user",
          content: [
            { type: "text", text: m.content },
            ...m.images.map((image) => ({
              type: "image_url" as const,
              image_url: { url: imageDataUrl(image) },
            })),
          ],
        };
      }
      return { role: m.role, content: m.content };
    }),
  ];
}

/** Verlauf für Gemini: Bilder als inlineData neben dem Text. */
export function toGeminiContents(messages: readonly LlmMessage[]) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [
      { text: m.content },
      ...(m.images ?? []).map((image) => ({
        inlineData: { mimeType: image.mediaType, data: image.base64 },
      })),
    ],
  }));
}

/**
 * Verlauf für Anthropic. Bilder stehen VOR dem Text: Anthropics eigene
 * Empfehlung, das Modell liest das Bild dann als Kontext der Frage.
 */
export function toAnthropicMessages(messages: readonly LlmMessage[]): Anthropic.MessageParam[] {
  return messages.map((m): Anthropic.MessageParam => {
    if (m.role === "user" && m.images?.length) {
      return {
        role: "user",
        content: [
          ...m.images.map(
            (image): Anthropic.ImageBlockParam => ({
              type: "image",
              source: {
                type: "base64",
                media_type: image.mediaType as Anthropic.Base64ImageSource["media_type"],
                data: image.base64,
              },
            })
          ),
          { type: "text", text: m.content },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}

/** OpenAI-kompatibler Inhaltsblock, von Z.ai und dem Custom-Slot geteilt. */
type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export function openAiParts(text: string, images: AnalysisImage[]): OpenAiContentPart[] | string {
  // Ohne Bilder die schlichte String-Form: manche OpenAI-kompatiblen Endpunkte
  // (der Custom-Slot kann alles Mögliche sein) vertragen die Array-Form nur
  // bei echten Vision-Modellen.
  if (images.length === 0) return text;
  return [
    { type: "text", text },
    ...images.map((image) => ({
      type: "image_url" as const,
      image_url: { url: `data:${image.mediaType};base64,${image.base64}` },
    })),
  ];
}
