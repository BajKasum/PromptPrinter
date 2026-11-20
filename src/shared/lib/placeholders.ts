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

/** Was die Person im Formular eingetragen hat, und welche Schlüssel sie als "kein Platzhalter" markiert hat. */
export type PlaceholderFill = { values: Record<string, string>; skipped: ReadonlySet<string> };

// Davor kein Wortzeichen, keine schliessende Klammer und kein "/", "<" oder ".": `liste[index]`, `[Text][ref]`,
// Routensegmente wie `/[id]/` in einem Pfad und Typen wie `Array<[string, number]>` sind keine Platzhalter.
// Dahinter kein "(" oder "[" (Markdown-Link, Bild) und kein ": http" (Verweis).
const BRACKET = /(?<![\w)\]\\/<.])\[([^[\]\n]{2,80})\](?!\(|\[|:\s*https?:)/gu;

function isPlaceholderText(inner: string): boolean {
  const text = inner.trim();
  if (text.length < 2) return false;
  if (!/\p{L}/u.test(text)) return false; // [1], [2, 3], [...]
  if (/^["'{[<#^]/.test(text)) return false; // ["a", "b"], [{...}], [<tag>]
  if (/[=;(){}]/.test(text)) return false; // Code: [i = 0], [f(x)]
  if (text.startsWith("..")) return false; // [...slug]
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

/** Ersetzt jeden Platzhalter samt Klammern durch das, was `replace` liefert; bei null bleibt er stehen. */
export function mapPlaceholders(prompt: string, replace: (placeholder: Placeholder) => string | null): string {
  let out = "";
  let cursor = 0;
  for (const hit of scan(prompt)) {
    const next = replace({ key: keyOf(hit.label), label: hit.label });
    if (next === null) continue;
    out += prompt.slice(cursor, hit.index) + next;
    cursor = hit.index + hit.length;
  }
  return out + prompt.slice(cursor);
}

/** Die getrimmte Eingabe zu einem Schlüssel, oder null (leer, nur Leerraum, oder als "kein Platzhalter" markiert). */
export function filledValue(key: string, values: Record<string, string>, skip: ReadonlySet<string>): string | null {
  // Nur eigene Schlüssel: ein Platzhalter "[constructor]" fände sonst Object.prototype.constructor.
  const value = Object.hasOwn(values, key) ? values[key]?.trim() : undefined;
  return value && !skip.has(key) ? value : null;
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
  return mapPlaceholders(prompt, (p) => filledValue(p.key, values, skip));
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
