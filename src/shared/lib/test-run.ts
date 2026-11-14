import * as z from "@/shared/lib/zod";

// Der Probelauf (api/test-run): ein fertiger Prompt geht einmal an das Modell der Person, ohne Finns Systemprompt.

/** So lang darf ein Prompt für einen Probelauf sein, in Zeichen. Länger ist kein Prompt mehr, sondern ein Dokument. */
export const TEST_RUN_MAX_PROMPT_CHARS = 20_000;

/** Der Körper der Anfrage: der Prompt als UTF-8, mit Luft für JSON. */
export const TEST_RUN_MAX_BODY_BYTES = TEST_RUN_MAX_PROMPT_CHARS * 4 + 1024;

/** Obergrenze der Antwort: genug, um zu sehen, wohin der Prompt führt, nicht genug für ein ganzes Werk auf unsere Kosten. */
export const TEST_RUN_MAX_OUTPUT_TOKENS = 1500;

/**
 * Mit eigenem Key: denkende Modelle (Gemini, OpenAI) zählen das Denken zur Ausgabe, mit 1500 bliebe oft kein sichtbarer
 * Text übrig. Die Kosten trägt der eigene Key, die Grenze hält nur ein ganzes Werk fern.
 */
export const TEST_RUN_MAX_OUTPUT_TOKENS_BYOK = 6000;

/**
 * Der Systemtext eines Probelaufs. Kein Finn, keine Regeln: so nah wie möglich an "in ein leeres Chatfenster
 * einfügen". Leer geht nicht, Anthropic lehnt einen leeren Systemtext ab.
 */
export const TEST_RUN_SYSTEM = "You are a helpful assistant.";

/**
 * `prompt` ist der Text, der läuft (mit ausgefüllten Platzhaltern), `original` der Prompt, wie Finn ihn geliefert
 * hat. Im Gratis-Rahmen ist `original` Pflicht: der Server lässt dort nur gelieferte Prompts laufen.
 */
export const testRunRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(TEST_RUN_MAX_PROMPT_CHARS),
  original: z.string().trim().min(1).max(TEST_RUN_MAX_PROMPT_CHARS).optional(),
});
