// Die eckigen Platzhalter eines fertigen Prompts ("[dein Name]", "[Adresse des Vermieters]"): Finn setzt
// sie, wo er etwas nicht wissen darf oder soll (Systemprompt). Hier werden sie erkannt und eingesetzt,
// rein im Browser (#224). Die Erkennung ist absichtlich eng: lieber ein Platzhalter zu wenig als ein
// Link, eine Quellenzahl oder eine Liste als Eingabefeld.

export type Placeholder = {
  /** Schlüssel für gleiche Platzhalter: kleingeschrieben, Leerraum zusammengefasst. */
  key: string;
  /** So steht er im Prompt, ohne die Klammern. */
  label: string;
};

// Davor kein Wortzeichen und keine schliessende Klammer: `liste[index]` und `[Text][ref]` sind keine
// Platzhalter. Dahinter kein "(" oder "[" (Markdown-Link, Bild) und kein ": http" (Verweis).
const BRACKET = /(?<![\w)\]\\])\[([^[\]\n]{2,80})\](?!\(|\[|:\s*https?:)/gu;

function isPlaceholderText(inner: string): boolean {
  const text = inner.trim();
  if (text.length < 2) return false;
  if (!/\p{L}/u.test(text)) return false; // [1], [2, 3], [...]
  if (/^["'{[<#^]/.test(text)) return false; // ["a", "b"], [{...}], [<tag>]
  if (/[=;(){}]/.test(text)) return false; // Code: [i = 0], [f(x)]
  return true;
}

const keyOf = (label: string) => label.replace(/\s+/g, " ").trim().toLowerCase();

type Hit = { index: number; length: number; label: string };

function scan(prompt: string): Hit[] {
  const hits: Hit[] = [];
  for (const m of prompt.matchAll(BRACKET)) {
    if (isPlaceholderText(m[1])) {
      hits.push({ index: m.index ?? 0, length: m[0].length, label: m[1].replace(/\s+/g, " ").trim() });
    }
  }
  return hits;
}

/** Die Platzhalter des Prompts, jeder nur einmal, in der Reihenfolge des ersten Auftretens. */
export function findPlaceholders(prompt: string): Placeholder[] {
  const seen = new Map<string, Placeholder>();
  for (const hit of scan(prompt)) {
    const key = keyOf(hit.label);
    if (!seen.has(key)) seen.set(key, { key, label: hit.label });
  }
  return [...seen.values()];
}

/**
 * Setzt die Eingaben ein. Ein Platzhalter ohne Eingabe (leer oder nur Leerraum) bleibt stehen, und
 * Schlüssel in `skip` sind von der Person als "kein Platzhalter" markiert und bleiben ebenfalls.
 */
export function fillPlaceholders(
  prompt: string,
  values: Record<string, string>,
  skip: ReadonlySet<string> = new Set()
): string {
  let out = "";
  let cursor = 0;
  for (const hit of scan(prompt)) {
    const key = keyOf(hit.label);
    const value = values[key]?.trim();
    if (!value || skip.has(key)) continue;
    out += prompt.slice(cursor, hit.index) + value;
    cursor = hit.index + hit.length;
  }
  return out + prompt.slice(cursor);
}
