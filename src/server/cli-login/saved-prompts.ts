import "server-only";

import { mapSavedPromptRows, type SavedPrompt } from "@/shared/lib/saved-prompts";

// Die gespeicherten Prompts für das Terminal (app/api/cli/prompts). Der MCP-Server des Terminal-Programms listet
// und liest sie, damit eine andere KI einen gespeicherten Prompt holen kann. Hier steht der reine Teil: Eingaben
// prüfen, das Suchmuster bauen, Zeilen in die Antwortform bringen. Auth und Abfrage stehen in den Routen.

/** Standard und Grenzen für `limit`. Eine Zahl außerhalb wird auf den Bereich geklemmt, keine Zahl ist ein Fehler. */
export const PROMPT_LIST_LIMIT = { default: 20, min: 1, max: 50 } as const;

/** Höchstlänge der Suche in Zeichen. Länger ist ein Fehler, nicht still gekürzt: der Aufrufer soll es merken. */
export const PROMPT_QUERY_MAX = 200;

/** Länge der Vorschau in Zeichen (Codepunkte, kein halbes Emoji am Ende). */
export const PROMPT_PREVIEW_CHARS = 200;

/** Gelesen wird nur, was die Antwort braucht. */
export const SAVED_PROMPT_COLUMNS = "id, created_at, outputs";

/** `null` heisst: ungültig (400). Fehlt der Wert, gilt der Standard. */
export function parseListLimit(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return PROMPT_LIST_LIMIT.default;
  if (!/^-?\d{1,6}$/.test(raw.trim())) return null;
  return Math.min(PROMPT_LIST_LIMIT.max, Math.max(PROMPT_LIST_LIMIT.min, Number(raw.trim())));
}

/** `undefined` heisst: keine Suche; `null`: zu lang (400). Leerraum am Rand zählt nicht mit. */
export function parseQuery(raw: string | null): string | undefined | null {
  if (raw === null) return undefined;
  const q = raw.trim();
  if (q.length === 0) return undefined;
  return q.length > PROMPT_QUERY_MAX ? null : q;
}

/**
 * Das Muster für `ilike` auf einer einzelnen Spalte. Der Suchtext geht nie in einen `.or(...)`-Ausdruck, dort
 * wären Komma, Klammer und Punkt Syntax. In einem einfachen Filter ist der ganze Rest nach `ilike.` der Wert,
 * zu entschärfen bleiben die Platzhalter von LIKE: `\`, `%` und `_` bekommen einen Backslash. PostgREST macht
 * aus jedem `*` ein `%`, ein maskierter Stern wäre danach `\%` und passte auf ein echtes Prozentzeichen; der
 * Stern wird deshalb `_` (ein beliebiges Zeichen). Das trifft mehr als gemeint, `containsQuery` siebt nach.
 */
export function likePattern(q: string): string {
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`).replaceAll("*", "_");
  return `%${escaped}%`;
}

/** Ob die Datenbank wegen eines Sterns mehr geliefert haben kann, als gesucht war. */
export function needsSieve(q: string): boolean {
  return q.includes("*");
}

/** Die genaue Prüfung ohne Gross/Klein, für die Zeilen, die `likePattern` zu großzügig traf. */
export function containsQuery(prompt: SavedPrompt, q: string): boolean {
  const needle = q.toLowerCase();
  return prompt.title.toLowerCase().includes(needle) || prompt.content.toLowerCase().includes(needle);
}

function preview(content: string): string {
  return Array.from(content).slice(0, PROMPT_PREVIEW_CHARS).join("");
}

type Row = { id: string; created_at: string; outputs: unknown };

/**
 * Führt die Treffer aus Titel und Prompttext zusammen: jede Zeile einmal, neueste zuerst, höchstens `limit`.
 * Zeilen ohne lesbaren Prompt fallen weg (mapSavedPromptRows), die Liste kann deshalb kürzer sein als `limit`.
 */
export function toListItems(rows: Row[], limit: number, q?: string) {
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  return mapSavedPromptRows(unique)
    .filter((p) => !q || !needsSieve(q) || containsQuery(p, q))
    .slice(0, limit)
    .map((p) => ({ id: p.id, title: p.title, createdAt: p.createdAt, preview: preview(p.content) }));
}

/** Eine Zeile als ganzer Prompt, oder `null`, wenn sie keinen lesbaren Prompt trägt. */
export function toDetail(row: Row): SavedPrompt | null {
  return mapSavedPromptRows([row])[0] ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nur eine UUID geht an die Datenbank, alles andere ist 400, bevor jemand fragt. */
export function isPromptId(id: string): boolean {
  return UUID.test(id);
}
