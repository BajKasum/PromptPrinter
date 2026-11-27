import "server-only";

// Der begrenzte Leser für Bodys von aussen: die Anfrage an eine Route (request-body.ts) und die Antwort eines fremden
// Servers (llm/http.ts, über sie auch der GitHub-Import).

/**
 * Liest `body` als UTF-8-Text, höchstens `maxBytes`. Liefert der Strom mehr, bricht er ab und wirft, was `tooLarge`
 * baut: sonst liefe die Übertragung weiter, obwohl niemand mehr liest.
 */
export async function readCappedStream(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
  tooLarge: () => Error
): Promise<string> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      // Vor dem Sammeln geprüft: im Speicher liegt nie mehr als ein Stück über der Grenze.
      if (total > maxBytes) {
        // Ohne `await`: der Fehler geht sofort hinaus, auch wenn sich die Quelle mit dem Abbrechen Zeit lässt.
        void reader.cancel().catch(() => {});
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
