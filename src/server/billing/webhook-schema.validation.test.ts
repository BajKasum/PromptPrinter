import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { webhookPayloadSchema } from "./lemonsqueezy";

// Vertrag der Eingabeprüfung (Betriebs-Audit, Folgesitzung 2026-10-07, Teil F, zod 4): was webhookPayloadSchema für
// jede Nutzlast ergibt, gültig mit den gelesenen Daten (Zahlen und Texte als IDs werden zu Texten, `test_mode` mit
// falschem Typ wird verworfen, unbekannte Felder bleiben) oder ungültig mit Pfaden und Meldungen. Die Route
// antwortet bei ungültig mit 400, die Meldung von zod geht ins Protokoll. Die Fälle stehen in
// webhook-schema.validation.cases.json, aufgenommen gegen zod 3.25.76 (`RECORD_VALIDATION=1 npx vitest run <diese
// Datei>`). Hält auch die Strenge von `.uuid()` und `.datetime({ offset: true })` fest.

const CASES_FILE = fileURLToPath(new URL("./webhook-schema.validation.cases.json", import.meta.url));
type Case = { name: string; body: unknown; result?: unknown };
const recorded: Case[] = JSON.parse(readFileSync(CASES_FILE, "utf8"));

function outcome(c: Case) {
  const parsed = webhookPayloadSchema.safeParse(c.body);
  return parsed.success
    ? { ok: true, data: JSON.parse(JSON.stringify(parsed.data)) }
    : { ok: false, issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })) };
}

describe("webhookPayloadSchema: Ergebnis je Nutzlast (Vertrag)", () => {
  if (process.env.RECORD_VALIDATION === "1") {
    it("nimmt die Ergebnisse auf", () => {
      writeFileSync(CASES_FILE, JSON.stringify(recorded.map((c) => ({ name: c.name, body: c.body, result: outcome(c) })), null, 2) + "\n");
    });
    return;
  }

  for (const c of recorded) {
    it(c.name, () => {
      expect(outcome(c)).toEqual(c.result);
    });
  }

  it("hat Fälle (der Vertrag ist nicht leer)", () => {
    expect(recorded.length).toBeGreaterThanOrEqual(70);
  });
});
