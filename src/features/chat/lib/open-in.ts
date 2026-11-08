// Wohin "In ChatGPT öffnen" und "In Claude öffnen" führen (prompt-actions.tsx).
//
// Eine Adresse mit vorbelegtem Text (chatgpt.com/?q=, claude.ai/new?q=) ist bei keinem der beiden Anbieter offiziell
// dokumentiert; bei ChatGPT schickt sie den Text laut Berichten sofort ab (von Tenable als Prompt-Injection-Weg
// gemeldet), bei Claude geht er ohne Anmeldung auf dem Umweg über die Login-Seite verloren. Deshalb gilt für beide
// der sichere Weg: der Prompt liegt in der Zwischenablage, die Seite öffnet sich leer, die Person fügt ihn ein und
// schickt ihn selbst ab.

export type OpenTarget = "chatgpt" | "claude";

const TARGETS: Record<OpenTarget, string> = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/new",
};

export function openTargetFor(target: OpenTarget): { url: string } {
  return { url: TARGETS[target] };
}
