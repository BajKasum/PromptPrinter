// The stub-mode reply /api/chat sends when no LLM provider is configured
// (dev/test only in practice, see that route's own C-8 comment on why it
// refuses to reach this in production). Split out of route.ts (QA finding
// C-1) purely to shrink that file; no behavior change.

// A placeholder answer that mirrors the real shape (a fenced, paste-ready
// prompt) so the UI can be exercised before an API key is configured.
export function stubReply(userText: string): string {
  const task = userText.trim() || "[deine Aufgabe]";
  return `_(Demo-Antwort, die KI-Anbindung ist gerade nicht aktiv, das hier ist nur eine Vorschau.)_

Hier ein Grundgerüst, das du anpassen kannst:

\`\`\`text
Du bist ein hilfreicher Experte für [Thema].

Aufgabe: ${task}

Kontext: [wichtige Hintergrundinfos, die die KI kennen muss]

Format: [gewünschtes Ausgabeformat]

Einschränkungen: [Länge, Ton, was vermieden werden soll]
\`\`\`

Sag mir, was ich schärfen soll, kürzer, ausführlicher, mit Beispiel, anderer Ton.`;
}
