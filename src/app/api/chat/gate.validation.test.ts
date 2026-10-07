import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestT } from "@/server/i18n";
import { readTranscript } from "./gate";

// Vertrag der Eingabeprüfung (Betriebs-Audit, Folgesitzung 2026-10-07, Teil F, zod 4): was der Chat-Zug für jeden
// Verlauf zurückgibt, entweder die Antwort (Statuscode und die GANZE Antwort: deutscher Text, Feldpfade,
// Meldungen von zod) oder den geprüften Verlauf selbst (getrimmt, geklemmt, mit verworfenen IDs). Die Fälle stehen
// in gate.validation.cases.json, aufgenommen gegen zod 3.25.76 (`RECORD_VALIDATION=1 npx vitest run <diese
// Datei>`). Auch die Strenge von `.uuid()` ist hier festgehalten (lockere UUIDs bleiben gültig).

vi.mock("@/server/supabase/server", () => ({ createClient: async () => null }));
vi.mock("@/server/supabase/admin", () => ({ createAdminClient: () => null }));

const CASES_FILE = fileURLToPath(new URL("./gate.validation.cases.json", import.meta.url));
type Case = { name: string; body: unknown; raw?: string; result?: unknown };
const recorded: Case[] = JSON.parse(readFileSync(CASES_FILE, "utf8"));

function request(c: Case) {
  return new Request("https://promptprinter.app/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: c.raw !== undefined ? c.raw : JSON.stringify(c.body),
  });
}

async function outcome(c: Case) {
  const req = request(c);
  const result = await readTranscript(req, requestT(req).t.api, "de");
  if (result instanceof Response) return { kind: "response", status: result.status, response: await result.json() };
  return { kind: "parsed", data: JSON.parse(JSON.stringify(result)) };
}

beforeEach(() => vi.clearAllMocks());

describe("readTranscript (POST /api/chat, Schritt 2): Ergebnis je Verlauf (Vertrag)", () => {
  if (process.env.RECORD_VALIDATION === "1") {
    it("nimmt die Ergebnisse auf", async () => {
      const out: Case[] = [];
      for (const c of recorded) {
        out.push({ name: c.name, body: c.body, ...(c.raw !== undefined ? { raw: c.raw } : {}), result: await outcome(c) });
      }
      writeFileSync(CASES_FILE, JSON.stringify(out, null, 2) + "\n");
    });
    return;
  }

  for (const c of recorded) {
    it(c.name, async () => {
      expect(await outcome(c)).toEqual(c.result);
    });
  }

  it("hat Fälle (der Vertrag ist nicht leer)", () => {
    expect(recorded.length).toBeGreaterThanOrEqual(85);
  });
});
