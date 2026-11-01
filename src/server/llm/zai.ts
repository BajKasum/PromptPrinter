import "server-only";

import { ZAI_ENDPOINT, zaiApiKey } from "@/server/llm/config";
import { readOpenAiCompatibleSse, streamDeadlines, throwProviderError } from "@/server/llm/http";
import { toOpenAiMessages } from "@/server/llm/messages";
import type { LlmMessage } from "@/server/llm/types";

// Z.ai, der Server-Standard (OpenAI-kompatibles chat/completions). Nur der Strom: ein Zug ohne
// eigenen Key läuft immer als Strom, die nicht gestreamte Analyse steht in analyze.ts.
// (Teil von src/server/llm/, siehe index.ts)

/**
 * So lange darf Z.ai bis zum ERSTEN Textstück brauchen (Betriebs-Audit M3).
 *
 * Ein hängender Anbieter, der weder antwortet noch die Verbindung schließt, blockierte den Zug
 * sonst bis zur maxDuration der Route (300 Sekunden), und weder Retry noch Failover bekamen je
 * einen Fehler zu sehen. glm-4.5-air liefert das erste Textstück normalerweise in wenigen
 * Sekunden (Denken ist ausgeschaltet); 30 Sekunden sind großzügig genug für einen langen
 * Projektkontext oder ein Bild und kurz genug, dass ein toter Anbieter nicht die ganze
 * Wartezeit kostet. Danach gelten Leerlauf-Frist und Gesamtgrenze (streamDeadlines in http.ts).
 */
export const ZAI_FIRST_CHUNK_TIMEOUT_MS = 30_000;

export async function* zaiCompleteStream(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const guard = streamDeadlines(signal, ZAI_FIRST_CHUNK_TIMEOUT_MS);
  try {
    const res = await fetch(ZAI_ENDPOINT, {
      method: "POST",
      signal: guard.signal,
      headers: {
        authorization: `Bearer ${zaiApiKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: toOpenAiMessages(system, messages),
        max_tokens: maxOutputTokens,
        stream: true,
        // GLM entscheidet sonst selbst, ob es "denkt": für einen Zug, auf den der Nutzer wartet,
        // kostet das nur Zeit und Ausgabebudget. Ausdrücklich aus.
        thinking: { type: "disabled" },
      }),
    });

    // Fehlertexte sind JSON mit error.message; fehlt die Form, geht gekürzter Rohtext weiter,
    // damit eine HTML-Seite eines Proxys die Meldung nicht flutet.
    if (!res.ok) await throwProviderError("Z.ai", res, { rawFallbackChars: 300 });
    if (!res.body) throw new Error("Z.ai hat keinen Antwort-Stream geliefert.");

    for await (const chunk of readOpenAiCompatibleSse(res.body)) {
      guard.received();
      yield chunk;
      guard.awaiting();
    }
  } finally {
    guard.stop();
  }
}
