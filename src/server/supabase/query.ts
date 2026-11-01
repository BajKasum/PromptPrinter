import "server-only";

// supabase-js wirft bei einem Fehler nicht, es liefert `{ data: null, error }`. Wer nur `data` liest, behandelt einen
// Datenbankaussetzer wie "es gibt nichts" (kein Plan, kein eigener Key, keine Konversation, kein Projekt), und aus dem
// Aussetzer wird eine falsche Fachentscheidung: eine Ablehnung, eine Rechnung auf dem Server-Key, ein abgespaltener
// Chat. Lesezugriffe, deren Abwesenheit etwas bedeutet, prüfen deshalb den Fehler (orThrow); die Route antwortet dann
// mit 503 und gibt ihre Reservierungen zurück. tests/guards/db-read-errors.test.ts hält fest, dass kein Lesezugriff
// den Fehler ungelesen lässt, außer den begründeten Ausnahmen dort.

export class DatabaseReadError extends Error {
  constructor(what: string, cause: unknown) {
    super(`database read failed: ${what}`, { cause });
    this.name = "DatabaseReadError";
  }
}

/** Gibt das Ergebnis zurück oder wirft DatabaseReadError, wenn die Abfrage einen Fehler lieferte. */
export function orThrow<T extends { error: { message: string } | null }>(result: T, what: string): T {
  if (result.error) throw new DatabaseReadError(what, result.error);
  return result;
}
