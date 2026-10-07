import { z } from "zod";

// zod 4 mit den Meldungen von zod 3 (Betriebs-Audit, Folgesitzung 2026-10-07, Teil F).
//
// Warum: die Routen geben `issues: [{ path, message }]` in der 400-Antwort weiter, und
// das Protokoll nennt dieselben Texte. zod 4 hat den Wortlaut aller Standardmeldungen
// geändert ("Required" wurde zu "Invalid input: expected string, received undefined",
// "String must contain at least 1 character(s)" zu "Too small: expected string to have
// >=1 characters" und so weiter). Die Antworten sind ein Vertrag, den die Tests neben den
// Routen festhalten (`*.validation.test.ts`); der Wechsel der Hauptversion soll sie nicht
// verändern. Wer die neuen Texte mag, löscht dieses Modul, ersetzt die Importe von
// "@/shared/lib/zod" durch "zod" und nimmt die Fälle neu auf (`RECORD_VALIDATION=1`).
//
// Nur ein Meldungstext: Entscheidungen (gültig, ungültig), Feldpfade und Statuscodes bleiben
// die von zod. Was hier nichts Passendes findet, bekommt den Standard von zod 4.
//
// Wichtig: jede Datei im Quelltext importiert `z` von hier, nie von "zod" (tests/guards/
// zod-import.test.ts). Sonst liefe ein Schema vor dem `z.config()` unten und bekäme den
// neuen Wortlaut.

type RawIssue = z.core.$ZodRawIssue;

/** Der Typ eines Werts, wie zod 3 ihn in "Expected X, received Y" nannte. */
function receivedType(value: unknown): string {
  switch (typeof value) {
    case "undefined":
      return "undefined";
    case "string":
      return "string";
    case "number":
      return Number.isNaN(value) ? "nan" : "number";
    case "boolean":
      return "boolean";
    case "function":
      return "function";
    case "bigint":
      return "bigint";
    case "symbol":
      return "symbol";
    case "object":
      if (Array.isArray(value)) return "array";
      if (value === null) return "null";
      if (value instanceof Map) return "map";
      if (value instanceof Set) return "set";
      if (value instanceof Date) return "date";
      return "object";
    default:
      return "unknown";
  }
}

// zod 3 brach bei diesen Fehlern die Prüfung eines Zweigs ab; andere (zu lang, falsches Format, unbekannte
// Schlüssel) ließen sie weiterlaufen. Das entschied dort, welcher Zweig einer Vereinigung gemeldet wurde
// (siehe responseIssues unten).
const ABORTING_CODES = new Set(["invalid_type", "invalid_value", "invalid_union"]);

function zod3Message(issue: RawIssue): string | undefined {
  try {
    switch (issue.code) {
      case "invalid_type": {
        const received = receivedType(issue.input);
        return received === "undefined" ? "Required" : `Expected ${issue.expected}, received ${received}`;
      }
      case "too_small": {
        const min = String(issue.minimum);
        const bound = issue.exact ? "exactly" : issue.inclusive ? "at least" : null;
        if (issue.origin === "string") return `String must contain ${bound ?? "over"} ${min} character(s)`;
        if (issue.origin === "array") return `Array must contain ${bound ?? "more than"} ${min} element(s)`;
        if (issue.origin === "number") {
          const phrase = issue.exact ? "exactly equal to " : issue.inclusive ? "greater than or equal to " : "greater than ";
          return `Number must be ${phrase}${min}`;
        }
        return undefined;
      }
      case "too_big": {
        const max = String(issue.maximum);
        const bound = issue.exact ? "exactly" : issue.inclusive ? "at most" : null;
        if (issue.origin === "string") return `String must contain ${bound ?? "under"} ${max} character(s)`;
        if (issue.origin === "array") return `Array must contain ${bound ?? "less than"} ${max} element(s)`;
        if (issue.origin === "number") {
          const phrase = issue.exact ? "exactly equal to " : issue.inclusive ? "less than or equal to " : "less than ";
          return `Number must be ${phrase}${max}`;
        }
        return undefined;
      }
      case "invalid_format":
        switch (issue.format) {
          case "email":
            return "Invalid email";
          case "url":
            return "Invalid url";
          case "guid":
          case "uuid":
            return "Invalid uuid";
          case "regex":
            return "Invalid";
          default:
            return undefined;
        }
      case "unrecognized_keys":
        return `Unrecognized key(s) in object: ${issue.keys.map((key) => `'${key}'`).join(", ")}`;
      default:
        return undefined;
    }
  } catch {
    // Die Meldung ist nur Beschriftung: ein Fehler hier darf nie eine Anfrage abbrechen.
    return undefined;
  }
}

/** Ein Fehler, wie die Routen ihn in der 400-Antwort ausgeben. */
export type ResponseIssue = { path: PropertyKey[]; message: string };

/**
 * Die Fehler für die 400-Antwort, aufgefächert wie unter zod 3.
 *
 * Bei einer Vereinigung (`z.union`) meldete zod 3 die Fehler des ERSTEN Zweigs, der nur "weiche" Fehler
 * hatte (zu lang, zu kurz, unbekannte Schlüssel), jeden mit seinem eigenen Pfad; gab es keinen solchen Zweig, ein
 * allgemeines "Invalid input". zod 4 liefert immer einen einzigen `invalid_union`-Fehler mit den Zweigen darin.
 * Hier wird der erste solche Zweig wieder aufgefächert (Pfade relativ zur Vereinigung, deshalb mit ihrem Pfad
 * davor); alles andere bleibt, wie zod es meldet.
 */
export function responseIssues(issues: readonly z.core.$ZodIssue[]): ResponseIssue[] {
  return issues.flatMap((issue): ResponseIssue[] => {
    if (issue.code === "invalid_union") {
      for (const option of issue.errors) {
        if (option.length > 0 && option.every((item) => !ABORTING_CODES.has(item.code))) {
          return responseIssues(option.map((item) => ({ ...item, path: [...issue.path, ...item.path] })));
        }
      }
    }
    return [{ path: [...issue.path], message: issue.message }];
  });
}

z.config({ customError: zod3Message });

export { z };
