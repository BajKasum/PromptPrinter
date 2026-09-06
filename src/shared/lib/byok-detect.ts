// Auto-detects which named BYOK provider a pasted API key belongs to, so the
// settings UI can offer a single "paste your key" field instead of asking the
// user to pick Anthropic/OpenAI/Gemini first (Nutzerwunsch 2026-09-06).
//
// Lives here, not in server/byok.ts: this needs to run both client-side (the
// live-typing badge in api-keys.tsx) and server-side (route.ts, which derives
// the provider authoritatively and never trusts the client's guess) — the
// same "a shared shape belongs to neither side" reasoning as byok-types.ts.
//
// Order matters: Anthropic keys ("sk-ant-...") also start with the generic
// "sk-" prefix OpenAI uses, so the Anthropic-specific check MUST run first,
// or every Anthropic key would be misclassified as OpenAI.
//
// This can only recognize the three named providers. Any other OpenAI-
// compatible endpoint (Z.ai, DeepSeek, Groq, OpenRouter, a self-hosted
// gateway, ...) needs its own base URL and model id, which no key string can
// carry — several of those also issue "sk-..."-shaped keys, so guessing
// "openai" for an unrecognized "sk-" key would be actively wrong. That case
// stays the separate, explicit "custom" flow.

export type NamedByokProvider = "anthropic" | "openai" | "gemini";

export function detectProviderFromKey(key: string): NamedByokProvider | null {
  const trimmed = key.trim();
  if (trimmed.startsWith("sk-ant-")) return "anthropic";
  if (trimmed.startsWith("AIza")) return "gemini";
  if (trimmed.startsWith("sk-")) return "openai";
  return null;
}

/** Display metadata for a named provider — shared between the live-typing badge, the connected-keys list, and toasts. */
export const NAMED_PROVIDER_META: Record<
  NamedByokProvider,
  { name: string; sub: string; logo: string }
> = {
  anthropic: { name: "Anthropic", sub: "Claude", logo: "Claude" },
  openai: { name: "OpenAI", sub: "GPT", logo: "ChatGPT" },
  gemini: { name: "Google", sub: "Gemini", logo: "Gemini" },
};
