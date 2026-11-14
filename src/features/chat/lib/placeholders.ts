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
    // Nur eigene Schlüssel: ein Platzhalter "[constructor]" fände sonst Object.prototype.constructor.
    const value = Object.hasOwn(values, key) ? values[key]?.trim() : undefined;
    if (!value || skip.has(key)) continue;
    out += prompt.slice(cursor, hit.index) + value;
    cursor = hit.index + hit.length;
  }
  return out + prompt.slice(cursor);
}

/**
 * Ist `filled` aus `original` entstanden, indem nur Platzhalter ersetzt wurden? Jeder Platzhalter steht für einen
 * beliebigen Text (auch sich selbst), alles dazwischen muss gleich bleiben. Das ist ein Muster mit Sternen zwischen
 * festen Stücken, und dafür ist das jeweils erste Vorkommen jedes mittleren Stücks immer eine richtige Wahl: kein
 * Zurückgehen, höchstens Länge mal Länge. Gleiche Platzhalter dürfen verschieden gefüllt sein, das schadet nicht.
 */
export function isFilledFrom(original: string, filled: string): boolean {
  const hits = scan(original);
  if (hits.length === 0) return filled === original;
  const pieces: string[] = [];
  let cursor = 0;
  for (const hit of hits) {
    pieces.push(original.slice(cursor, hit.index));
    cursor = hit.index + hit.length;
  }
  pieces.push(original.slice(cursor));

  const first = pieces[0];
  const last = pieces[pieces.length - 1];
  if (!filled.startsWith(first) || filled.length < first.length + last.length || !filled.endsWith(last)) return false;
  const end = filled.length - last.length;
  let at = first.length;
  for (const piece of pieces.slice(1, -1)) {
    const found = filled.indexOf(piece, at);
    if (found < 0 || found + piece.length > end) return false;
    at = found + piece.length;
  }
  return true;
}
