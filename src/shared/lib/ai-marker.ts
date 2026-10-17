/**
 * Kennzeichnung KI-erzeugter Inhalte, soweit sie die App als Datei oder Strom verlassen
 * (EU-KI-Verordnung Art. 50 Abs. 2, Rechts-Audit R-9).
 *
 * Was das ist und was nicht: eine **erste, maschinenlesbare Schicht**. Der Verhaltenskodex der
 * Kommission (Juni 2026) verlangt für Text mehrere Schichten (Metadaten, Wasserzeichen u. a.) und
 * Wege, die Herkunft zu prüfen; ein anerkanntes Verfahren für reinen Text gibt es noch nicht.
 * Hier steht nur, was sich ohne den Inhalt zu verändern setzen lässt:
 *
 *   - die Antwort von /api/chat trägt den Kopf `x-ai-generated: true`,
 *   - eine heruntergeladene Markdown-Datei beginnt mit einem HTML-Kommentar (in der Ansicht
 *     unsichtbar, im Rohtext lesbar),
 *   - eine exportierte PDF trägt die Eigenschaften Betreff und Schlüsselwort und unten auf jeder
 *     Seite den sichtbaren Hinweis.
 *
 * Nicht gekennzeichnet: der Text im Chat selbst und beim Kopieren. Der erste Hinweis steht dort
 * (Art. 50 Abs. 1, "Finn ist eine KI und kann Fehler machen" unter dem Eingabefeld); in den Prompt,
 * der in eine andere KI eingefügt wird, schreiben wir keine Markierung, sie würde das Ergebnis
 * verändern. Ob das genügt, ist offen, siehe docs/SETUP.md, "KI-Kennzeichnung".
 */
export const AI_GENERATED_MARKER = "<!-- ai-generated: true; generator: PromptPrinter (Finn) -->";

export const AI_GENERATED_SUBJECT = "Mit KI erzeugt (PromptPrinter)";
export const AI_GENERATED_KEYWORD = "ai-generated";
export const AI_GENERATED_FOOTER = "PromptPrinter · mit KI erzeugt";

/** Setzt die Markierung vor ein Markdown-Dokument, einmal (ein markiertes Dokument bleibt, wie es ist). */
export function markAiMarkdown(markdown: string): string {
  if (markdown.startsWith(AI_GENERATED_MARKER)) return markdown;
  return `${AI_GENERATED_MARKER}\n\n${markdown}`;
}
