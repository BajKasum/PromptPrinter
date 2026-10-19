import "server-only";

import { problem } from "@/server/http/api-problem";
import { flattenIssues, responseIssues, type z } from "@/shared/lib/zod";
import type { Messages } from "@/shared/i18n/messages/de";
import { fmt } from "@/shared/i18n/format";

// Wie eine abgewiesene Eingabe beim Nutzer ankommt (#130). Die Routen schickten
// `detail: "Invalid request"`, auf Englisch und ohne zu sagen, welches Feld es war,
// und die Oberfläche zeigt nur `detail`. Jetzt steht dort ein Satz in der Sprache des
// Aufrufers, der das Feld nennt. `issues` bleibt, wie es war: der maschinenlesbare
// Teil der Antwort, den die `*.validation.cases.json` neben den Routen festhalten.

type ApiMessages = Messages["api"];

/** Der Rumpf ist kein lesbares JSON. */
export function invalidJsonProblem(m: ApiMessages) {
  return problem(400, m.unreadable);
}

/**
 * Ein Satz zum ersten Fehler. Nennt das Feld nur, wenn das Wörterbuch es kennt
 * (`api.fields`) und der Fehler sich in einfachen Worten sagen lässt (leer, zu kurz, zu
 * lang, keine Adresse, keine E-Mail-Adresse). Alles andere, etwa ein unbekannter
 * Schlüssel, bleibt bei dem allgemeinen Satz: das macht kein Nutzer von Hand.
 */
export function describeIssue(issue: z.core.$ZodIssue, m: ApiMessages): string {
  const key = String(issue.path[0] ?? "");
  const labels: Record<string, string> = m.fields;
  const field = Object.hasOwn(labels, key) ? labels[key] : undefined;
  if (!field) return m.unprocessable;

  switch (issue.code) {
    // Ein fehlendes Feld ist für den Nutzer ein leeres.
    case "invalid_type":
      return fmt(m.fieldEmpty, { field });
    case "too_small":
      if (issue.origin !== "string") break;
      return Number(issue.minimum) <= 1
        ? fmt(m.fieldEmpty, { field })
        : fmt(m.fieldTooShort, { field, min: String(issue.minimum) });
    case "too_big":
      if (issue.origin !== "string") break;
      return fmt(m.fieldTooLong, { field, max: String(issue.maximum) });
    case "invalid_format":
      if (issue.format === "url") return fmt(m.fieldUrl, { field });
      if (issue.format === "email") return m.invalidEmail;
      break;
  }
  return m.unprocessable;
}

/**
 * 400 für eine Eingabe, die das Schema ablehnt. `describe` benennt, WAS dem Nutzer
 * gesagt wird, wenn das nicht dieselben Fehler sind wie die der Antwort: bei einer
 * Vereinigung meldet `issues` den ersten weichen Zweig (siehe `responseIssues`), der
 * Nutzer meint aber den Zweig, den er ausgefüllt hat.
 */
export function validationProblem(
  m: ApiMessages,
  issues: readonly z.core.$ZodIssue[],
  describe: readonly z.core.$ZodIssue[] = issues
) {
  const first = flattenIssues(describe)[0];
  return problem(400, first ? describeIssue(first, m) : m.unprocessable, {
    issues: responseIssues(issues),
  });
}
