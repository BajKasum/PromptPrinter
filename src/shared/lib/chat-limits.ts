// Die Grössengrenzen eines Chat-Zugs an einer Stelle: Composer (Browser), Zod-Schema (Vertrag der Anfrage) und
// /api/chat (Kürzen vor dem Prüfen) halten sich an dieselben Zahlen. Ohne zod, damit der Browser-Code sie importieren
// kann, ohne zod mitzuladen: lib/schemas.ts importiert von hier, nicht umgekehrt.

/**
 * Höchstzahl der Nachrichten in einer Anfrage. /api/chat kürzt einen längeren Verlauf vor der Prüfung auf die neuesten
 * (normalizeTranscript), sonst scheiterte in einem langen Chat jeder weitere Zug. An das Modell gehen davon höchstens
 * CHAT_HISTORY_LIMIT, der Rest ist Spielraum.
 */
export const MAX_TRANSCRIPT_MESSAGES = 24;

/** Längste Nachricht eines Nutzers. Der Composer begrenzt das Feld, das Schema weist einen direkten POST ab. */
export const MAX_USER_MESSAGE_CHARS = 8000;

/**
 * Längste Antwort, die gespeichert und wieder mitgeschickt wird, Längeres wird gekürzt. Höher als die Grenze für
 * Nutzer, weil das Ausgabebudget des Modells sie bestimmt (DEFAULT_MAX_OUTPUT_TOKENS in server/llm/config.ts, rund
 * 20 000 bis 25 000 Zeichen): wer das Budget anhebt, prüft diese Zahl mit.
 */
export const MAX_ASSISTANT_MESSAGE_CHARS = 40000;

/** Wie viele Nachrichten eine Chat-Seite lädt, die neuesten. Ältere zeigt sie nicht, ein Nachladen gibt es nicht. */
export const MESSAGE_LOAD_LIMIT = 300;

/** Wie viele gespeicherte Prompts Chat-Seiten und /prompts höchstens laden: sonst wüchse die Abfrage mit dem Konto. */
export const SAVED_PROMPTS_LOAD_LIMIT = 200;

/**
 * Wie viele Zeilen die Listen von Chats und Projekten höchstens zeigen. Die Listenseiten lesen mit
 * `.range(0, LIST_LOAD_LIMIT)` eine Zeile mehr, damit splitAtLimit sagen kann, ob etwas fehlt.
 */
export const LIST_LOAD_LIMIT = 100;

/**
 * Teilt eine um eine Zeile zu weit gelesene Liste in die angezeigten Zeilen und "es gibt mehr". So braucht es keine
 * zweite Abfrage mit `count`, um "genau an der Grenze" von "darüber" zu unterscheiden.
 */
export function splitAtLimit<T>(rows: T[], limit: number = LIST_LOAD_LIMIT): {
  items: T[];
  hasMore: boolean;
} {
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

/** Kürzt `s` auf höchstens `max` Zeichen, das Auslassungszeichen eingerechnet: sonst läge das Ergebnis über der Grenze. */
export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// ─── Anhänge einer Chat-Nachricht (Fotos und Dateien) ─────────────────────
//
// Wie die Grenzen oben an mehreren Stellen erzwungen: Composer (damit nichts
// Unzulässiges überhaupt erst hochgeladen wird), Zod-Schema (Vertrag der
// Route) und die Route selbst (Magic Bytes, Speicherkontingent). Migration
// 0045 spiegelt die Spaltengrenzen und die des Buckets.

/** Wie viele Anhänge eine einzelne Nachricht tragen darf. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 4;

/**
 * Längste Kante eines Bildes, wie es an das Modell geht. Der Browser skaliert
 * grössere Bilder vor dem Senden herunter: Modelle verkleinern ohnehin selbst
 * (Anthropic empfiehlt höchstens ~1568 px), alles darüber kostet nur Upload
 * und Eingabe-Token, ohne dass Finn mehr erkennt.
 */
export const MAX_ATTACHMENT_IMAGE_EDGE = 1568;

/** Ein Bild nach dem Skalieren. Ein Screenshot liegt typischerweise bei 150-500 KB. */
export const MAX_ATTACHMENT_IMAGE_BYTES = 1024 * 1024; // 1 MB

/** Eine Textdatei, in Bytes. Gleiche Grenze wie Textdateien im Projekt. */
export const MAX_ATTACHMENT_TEXT_BYTES = 200 * 1024; // 200 KB

/**
 * Summe aller Anhänge EINER Nachricht, Rohbytes. Die Anhänge reisen als
 * Base64 im JSON-Body (+33 %), und Vercel nimmt Funktionen höchstens 4,5 MB
 * Body ab: 2 MB roh sind rund 2,7 MB Base64, der Rest bleibt dem Verlauf.
 */
export const MAX_ATTACHMENTS_REQUEST_BYTES = 2 * 1024 * 1024;

/**
 * Wie viel Anhang-Speicher ein Konto insgesamt belegen darf. Der Bucket ist
 * privat und gehört dem Betreiber, ohne diese Grenze wäre er pro Konto
 * unbegrenzt (bei 100 MB sind das rund 300 Screenshots). Beim Löschen von
 * Chats wird der Platz wieder frei.
 */
export const MAX_ATTACHMENT_STORAGE_PER_USER = 100 * 1024 * 1024;

/** Höchstens so viele Bilder gehen in EINEN Modellaufruf, neueste zuerst. */
export const MAX_MODEL_IMAGES = 4;

/**
 * Wie viel einer Textdatei Finn liest. Das Modell bezahlt jedes Zeichen bei
 * jedem Zug erneut, wo die Datei noch im Verlauf liegt, und "nicht Credits
 * verbrennen" ist das Versprechen dieses Produkts: ein 200-KB-Log wird
 * gekürzt statt jedes Mal in voller Länge mitgeschickt.
 */
export const ATTACHMENT_TEXT_CHARS_PER_FILE = 12_000;

/** Obergrenze für allen Anhangs-Text in einem einzigen Modellaufruf. */
export const ATTACHMENT_TEXT_CHARS_TOTAL = 24_000;
