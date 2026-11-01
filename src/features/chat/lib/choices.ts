// Antwortvorschläge zu Finns Rückfrage (#225). Finn darf seiner Rückfrage einen Block anhängen:
//
//   ```choices
//   Welcher Ton? | sachlich | freundlich | locker
//   Wie lang? | kurz | ausführlich
//   ```
//
// eine Zeile je Frage, danach 2 bis 4 Optionen. Die Oberfläche blendet den Block aus und zeigt Tippflächen.
// Fehlt der Block oder ist er kaputt, bleibt alles wie vorher: ein Block, der nicht streng in die Form
// passt, wird nicht angerührt und erscheint wie jeder andere Codeblock.

export type ChoiceQuestion = { question: string; options: string[] };

const MAX_QUESTIONS = 4;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;
const MAX_QUESTION_CHARS = 120;
const MAX_OPTION_CHARS = 60;

const FENCE = /```choices[ \t]*\r?\n([\s\S]*?)```[ \t]*(?:\r?\n|$)/g;
const OPEN_MARK = "```choices";

const clean = (s: string) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").replace(/\s+/g, " ").trim();
const HAS_CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;

/** Liest die Zeilen eines `choices`-Blocks streng; Zeilen, die nicht passen, fallen weg. */
export function parseChoices(body: string): ChoiceQuestion[] {
  const out: ChoiceQuestion[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (HAS_CONTROL.test(line)) continue;
    const parts = line.split("|").map(clean);
    const [question, ...options] = parts;
    if (!question || question.length > MAX_QUESTION_CHARS) continue;
    if (options.some((o) => o.length === 0 || o.length > MAX_OPTION_CHARS)) continue;
    if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) continue;
    out.push({ question, options });
    if (out.length === MAX_QUESTIONS) break;
  }
  return out;
}

/**
 * Trennt die Antwort in den sichtbaren Text und die Vorschläge. Nur der letzte vollständige Block zählt, und nur
 * wenn mindestens eine Zeile streng passt; sonst bleibt der Text unverändert und `choices` ist `null`.
 */
export function splitChoices(content: string): { text: string; choices: ChoiceQuestion[] | null } {
  const matches = [...content.matchAll(FENCE)];
  const last = matches.at(-1);
  if (!last || last.index === undefined) return { text: content, choices: null };
  const choices = parseChoices(last[1]);
  if (choices.length === 0) return { text: content, choices: null };
  const text = (content.slice(0, last.index) + content.slice(last.index + last[0].length)).replace(/\n{3,}/g, "\n\n").trimEnd();
  return { text, choices };
}

/** Für die Anzeige während des Schreibens: den fertigen Block ausblenden und einen noch offenen auch. */
export function hideChoicesWhileStreaming(content: string): string {
  const { text } = splitChoices(content);
  const open = text.lastIndexOf(OPEN_MARK);
  // Offen heisst: nach dem Anfang des Blocks kommt kein schliessender Zaun mehr. Ein vollständiger, aber
  // unbrauchbarer Block bleibt stehen, samt allem, was danach folgt.
  if (open !== -1 && !text.slice(open + OPEN_MARK.length).includes("```")) return text.slice(0, open).trimEnd();
  return text;
}
