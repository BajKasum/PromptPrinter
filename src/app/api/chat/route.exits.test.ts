import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { ZAI_CONSENT_VERSION } from "@/server/consent";
import { chatStreamSchemas, type ChatStreamEventName } from "@/shared/lib/chat-stream";

// Ein Konto, das der Übermittlung an Z.ai zugestimmt hat (server/consent.ts): ohne sie antwortet der
// Server-Key-Pfad mit 403 consentRequired. Das Verhalten ohne Zustimmung steht in consent.test.ts und im Abschnitt
// "Zustimmung zur Übermittlung an Z.ai" der Route.
const consented = { zai_consent: { version: ZAI_CONSENT_VERSION, at: "2026-10-17T00:00:00.000Z" } };

// Reihenfolge der Schranken und Rückgabe der Reservierungen an JEDEM Ausstieg von
// POST /api/chat (Betriebs-Audit M7, Teil 3).
//
// route.test.ts und route.attachments.test.ts prüfen, WAS die Route tut. Dass sie
// dabei die Reservierungen zurückgibt, wenn ein Zug nichts gekostet hat, und sie
// behält, wenn er etwas gekostet hat, ist an wenigen Stellen belegt (Budget bei
// Anbieterfehler, Produktionssperre). Diese Datei hält es für ALLE Ausstiege fest,
// damit POST in benannte Schritte zerlegt werden kann, ohne dass ein Ausstieg die
// Reservierung stillschweigend verliert: ein verlorener Platz im Monatskontingent
// oder im Tagesbudget kostet jemanden eine Nachricht, die nie beantwortet wurde.
//
// Zwei Reservierungen gibt es: das Monatskontingent (zuerst) und das Tagesbudget
// des Server-Keys (zuletzt vor dem Modell). Beide stehen hier als eigene Zähler.

const log: string[] = [];
const getUser = vi.fn();
const createClient = vi.fn();
const rateLimit = vi.fn();
const reserveMonthlyQuota = vi.fn();
const reserveServerKeyCall = vi.fn();
const getUserOverride = vi.fn();
const chatCompleteStream = vi.fn();
const llmConfig = vi.fn();
const monthlyRelease = vi.fn();
const budgetRelease = vi.fn();

const tableResults: Record<string, { data?: unknown; error?: unknown; count?: number }> = {};
const insertCalls: Record<string, unknown[]> = {};
const deleteCalls: Record<string, number> = {};
let failAssistantInsert = false;

function builder(table: string) {
  let lastRow: { role?: string } | undefined;
  const result = () => {
    if (table === "messages" && failAssistantInsert && lastRow?.role === "assistant") {
      return { data: null, error: { message: "insert failed" } };
    }
    return tableResults[table] ?? { data: null, error: null, count: 0 };
  };
  const chain: Record<string, unknown> = {
    maybeSingle: vi.fn(async () => result()),
    single: vi.fn(async () => result()),
    then: (resolve: (v: unknown) => unknown) => resolve(result()),
  };
  for (const method of ["select", "eq", "gte", "is", "order", "limit", "update"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.insert = vi.fn((row: { role?: string }) => {
    lastRow = row;
    (insertCalls[table] ??= []).push(row);
    log.push(`insert:${table}${row.role ? `:${row.role}` : ""}`);
    return chain;
  });
  chain.delete = vi.fn(() => {
    deleteCalls[table] = (deleteCalls[table] ?? 0) + 1;
    return chain;
  });
  return chain;
}

const supabaseStub = {
  auth: { getUser },
  from: (table: string) => {
    log.push(`from:${table}`);
    return builder(table);
  },
  storage: { from: () => ({ download: async () => ({ data: null, error: new Error("n/a") }) }) },
};

vi.mock("@/server/supabase/server", () => ({
  createClient: () => createClient(),
  createClientForRequest: () => createClient(),
}));
vi.mock("@/server/security/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/security/rate-limit")>();
  return {
    ...actual,
    rateLimit: (...a: unknown[]) => rateLimit(...a),
    rateLimitKey: () => "u:user-1",
    reserveMonthlyQuota: (...a: unknown[]) => reserveMonthlyQuota(...a),
    reserveServerKeyCall: (...a: unknown[]) => reserveServerKeyCall(...a),
  };
});
vi.mock("@/server/byok", () => ({ getUserOverride: (...a: unknown[]) => getUserOverride(...a) }));
// Der Gratis-Rahmen (server/free-trial.ts): Standard ist "aufgebraucht", dann gilt für Free ohne Key der Key-Weg wie
// vor dem Rahmen. Die Tests des Rahmens setzen beides selbst.
const freePromptsLeft = vi.fn();
const reserveFreeTrialTurn = vi.fn();
vi.mock("@/server/free-trial", () => ({
  freePromptsLeft: (...a: unknown[]) => freePromptsLeft(...a),
  reserveFreeTrialTurn: (...a: unknown[]) => reserveFreeTrialTurn(...a),
}));

vi.mock("@/server/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/llm")>();
  return {
    ...actual,
    chatCompleteStream: (...a: unknown[]) => chatCompleteStream(...a),
    llmConfig: () => llmConfig(),
  };
});

function req(body: unknown = { messages: [{ role: "user", content: "Hi" }] }, signal?: AbortSignal) {
  return new Request("https://promptprinter.app/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
}

/** Liest einen Stream bis zum Ende und gibt den Text zurück. */
const text = (res: Response) => res.text();

beforeEach(() => {
  vi.clearAllMocks();
  log.length = 0;
  failAssistantInsert = false;
  for (const table of Object.keys(insertCalls)) delete insertCalls[table];
  for (const table of Object.keys(deleteCalls)) delete deleteCalls[table];

  createClient.mockResolvedValue(supabaseStub);
  getUser.mockImplementation(async () => {
    log.push("session");
    return { data: { user: { id: "user-1", app_metadata: consented } } };
  });
  getUserOverride.mockImplementation(async () => {
    log.push("getUserOverride");
    return null;
  });
  freePromptsLeft.mockResolvedValue(0);
  reserveFreeTrialTurn.mockResolvedValue("exhausted");
  rateLimit.mockImplementation(async () => {
    log.push("rateLimit");
    return { allowed: true, remaining: 119, resetAt: Date.now() + 1000 };
  });
  monthlyRelease.mockImplementation(async () => {
    log.push("release:monthly");
  });
  budgetRelease.mockImplementation(async () => {
    log.push("release:budget");
  });
  reserveMonthlyQuota.mockImplementation(async () => {
    log.push("reserveMonthlyQuota");
    return { allowed: true, release: monthlyRelease };
  });
  reserveServerKeyCall.mockImplementation(async () => {
    log.push("reserveServerKeyCall");
    return { allowed: true, release: budgetRelease };
  });
  llmConfig.mockReturnValue({ provider: "zai", model: "glm-4.5-air" });
  chatCompleteStream.mockImplementation(async function* () {
    log.push("model");
    yield "Hallo";
  });

  tableResults.profiles = { data: { plan: "pro", is_admin: false } };
  tableResults.messages = { data: { id: "msg-1" }, error: null, count: 3 };
  tableResults.conversations = { data: { id: "conv-1" }, error: null };
  tableResults.projects = { data: null, error: null };
  tableResults.project_files = { data: [], error: null };
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const calls = (mock: { mock: { calls: unknown[] } }) => mock.mock.calls.length;

// ─── Die Reihenfolge der Schranken ───────────────────────────────────────────

describe("Reihenfolge der Schranken", () => {
  it("Sitzung → Profil → Kontingent → Stundengrenze → Tagesbudget → Zug öffnen → Modell", async () => {
    const res = await POST(req());
    await text(res);

    const at = (entry: string) => log.indexOf(entry);
    const order = [
      "session",
      "from:profiles",
      "reserveMonthlyQuota",
      "rateLimit",
      "reserveServerKeyCall",
      "insert:conversations",
      "insert:messages:user",
      "model",
      "insert:messages:assistant",
    ];
    for (const entry of order) expect(at(entry), `${entry} fehlt im Ablauf: ${log.join(" > ")}`).toBeGreaterThanOrEqual(0);
    const positions = order.map(at);
    expect(positions, `Ablauf: ${log.join(" > ")}`).toEqual([...positions].sort((a, b) => a - b));
  });

  it("die Sitzung wird geprüft, BEVOR der Body gelesen wird", async () => {
    getUser.mockImplementation(async () => ({ data: { user: null } }));
    // Ein kaputter Body bekommt ohne Sitzung 401, nicht 400.
    const res = await POST(req("{ kaputt"));
    expect(res.status).toBe(401);
  });

  it("Anhänge und Body werden geprüft, bevor irgendetwas reserviert wird", async () => {
    const res = await POST(req({ messages: [] }));
    expect(res.status).toBe(400);
    expect(calls(reserveMonthlyQuota)).toBe(0);
    expect(calls(reserveServerKeyCall)).toBe(0);
    expect(calls(rateLimit)).toBe(0);
  });

  it("ein BYOK-Konto reserviert weder Kontingent noch Tagesbudget, wird aber begrenzt", async () => {
    getUserOverride.mockImplementation(async () => ({ provider: "anthropic", apiKey: "k" }));
    await text(await POST(req()));
    expect(calls(reserveMonthlyQuota)).toBe(0);
    expect(calls(reserveServerKeyCall)).toBe(0);
    expect(calls(rateLimit)).toBe(1);
  });

  it("ein Admin umgeht die Stundengrenze, nicht das Tagesbudget", async () => {
    tableResults.profiles = { data: { plan: "pro", is_admin: true } };
    await text(await POST(req()));
    expect(calls(rateLimit)).toBe(0);
    expect(calls(reserveServerKeyCall)).toBe(1);
  });
});

// ─── Ausstiege VOR der ersten Reservierung ──────────────────────────────────

describe("Ausstiege vor jeder Reservierung reservieren nichts", () => {
  const untouched = () => {
    expect(calls(reserveMonthlyQuota)).toBe(0);
    expect(calls(reserveServerKeyCall)).toBe(0);
    expect(calls(rateLimit)).toBe(0);
    expect(calls(monthlyRelease)).toBe(0);
    expect(calls(budgetRelease)).toBe(0);
    expect(calls(chatCompleteStream)).toBe(0);
  };

  it("Supabase nicht erreichbar (503)", async () => {
    createClient.mockRejectedValue(new Error("down"));
    expect((await POST(req())).status).toBe(503);
    untouched();
  });

  it("keine Sitzung (401)", async () => {
    getUser.mockImplementation(async () => ({ data: { user: null } }));
    expect((await POST(req())).status).toBe(401);
    untouched();
  });

  it("unlesbarer Body (400)", async () => {
    expect((await POST(req("{ kaputt"))).status).toBe(400);
    untouched();
  });

  it("Schema verletzt (400)", async () => {
    expect((await POST(req({ messages: "kein array" }))).status).toBe(400);
    untouched();
  });

  it("letzte Nachricht nicht vom Nutzer (400)", async () => {
    const res = await POST(req({ messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] }));
    expect(res.status).toBe(400);
    untouched();
  });

  it("Free ohne eigenen Key und ohne Gratis-Prompts (403 byokRequired): kein Aufruf des Kontingents", async () => {
    tableResults.profiles = { data: { plan: "free", is_admin: false } };
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect((await res.json()).kind).toBe("byokRequired");
    untouched();
  });

  it("gespeicherter Key nicht lesbar (409): kein Kontingent, kein Rückfall auf den Server-Key", async () => {
    tableResults.profiles = { data: { plan: "pro", is_admin: false } };
    getUserOverride.mockImplementation(async () => "unreadable");
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).kind).toBe("byokUnreadable");
    untouched();
  });
});

// ─── Ausstiege NACH einer Reservierung: Rückgabe oder Behalten ───────────────

describe("jeder Ausstieg nach der Reservierung gibt sie zurück, wenn der Zug nichts gekostet hat", () => {
  it("Monatskontingent erschöpft (403): die eigene Reservierung geht zurück, nichts weiter", async () => {
    reserveMonthlyQuota.mockImplementation(async () => {
      log.push("reserveMonthlyQuota");
      return { allowed: false, release: monthlyRelease };
    });
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect((await res.json()).kind).toBe("chatMessages");
    expect(calls(monthlyRelease)).toBe(1);
    expect(calls(rateLimit)).toBe(0);
    expect(calls(reserveServerKeyCall)).toBe(0);
  });

  it("Stundengrenze (429): das Monatskontingent geht zurück, das Tagesbudget wurde noch nie reserviert", async () => {
    rateLimit.mockImplementation(async () => ({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 }));
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect(calls(monthlyRelease)).toBe(1);
    expect(calls(reserveServerKeyCall)).toBe(0);
    expect(calls(budgetRelease)).toBe(0);
    expect(calls(chatCompleteStream)).toBe(0);
  });

  it("Tagesbudget aufgebraucht (503): die eigene Reservierung UND das Monatskontingent gehen zurück", async () => {
    reserveServerKeyCall.mockImplementation(async () => {
      log.push("reserveServerKeyCall");
      return { allowed: false, release: budgetRelease };
    });
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(calls(budgetRelease)).toBe(1);
    expect(calls(monthlyRelease)).toBe(1);
    expect(calls(chatCompleteStream)).toBe(0);
  });

  it("in Produktion ohne Anbieter (503): beide gehen zurück, das Modell wird nie gefragt", async () => {
    vi.stubEnv("NODE_ENV", "production");
    llmConfig.mockReturnValue(null);
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(calls(monthlyRelease)).toBe(1);
    expect(calls(budgetRelease)).toBe(1);
    expect(calls(chatCompleteStream)).toBe(0);
  });

  it("Zug lässt sich nicht öffnen (503): beide gehen zurück, nichts wird gefragt oder geschrieben", async () => {
    tableResults.conversations = { data: null, error: { message: "insert failed" } };
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(calls(monthlyRelease)).toBe(1);
    expect(calls(budgetRelease)).toBe(1);
    expect(calls(chatCompleteStream)).toBe(0);
    expect(insertCalls.messages ?? []).toHaveLength(0);
  });

  it("Anbieter scheitert (Fehlerereignis): beide gehen zurück, die Frage wird zurückgenommen", async () => {
    chatCompleteStream.mockImplementation(async function* () {
      throw new Error("Z.ai 500: down");
    });
    const body = await text(await POST(req()));
    expect(body).toContain("event: error");
    expect(calls(monthlyRelease)).toBe(1);
    expect(calls(budgetRelease)).toBe(1);
    expect(deleteCalls.conversations ?? 0).toBe(1);
  });

  it("Strom bleibt nach dem ersten Wort stehen (Zeitlimit): Fehlerereignis, beide gehen zurück, die Frage wird zurückgenommen", async () => {
    chatCompleteStream.mockImplementation(async function* () {
      yield "halbe ";
      throw new DOMException("no chunk within 45000 ms", "TimeoutError");
    });
    const body = await text(await POST(req()));
    expect(body).toContain("event: error");
    expect(body).not.toContain("event: done");
    expect(calls(monthlyRelease)).toBe(1);
    expect(calls(budgetRelease)).toBe(1);
    expect(deleteCalls.conversations ?? 0).toBe(1);
    expect(insertCalls.messages?.some((r) => (r as { role?: string }).role === "assistant") ?? false).toBe(false);
  });

  it("leere Antwort des Anbieters: wie ein Fehler, beide gehen zurück", async () => {
    chatCompleteStream.mockImplementation(async function* () {
      yield "   ";
    });
    const body = await text(await POST(req()));
    expect(body).toContain("event: error");
    expect(calls(monthlyRelease)).toBe(1);
    expect(calls(budgetRelease)).toBe(1);
  });

  it("Abbruch durch den Nutzer OHNE Teiltext: beide gehen zurück, die Frage bleibt stehen", async () => {
    const controller = new AbortController();
    chatCompleteStream.mockImplementation(async function* () {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    await text(await POST(req(undefined, controller.signal)));
    expect(calls(monthlyRelease)).toBe(1);
    expect(calls(budgetRelease)).toBe(1);
    expect(deleteCalls.conversations ?? 0).toBe(0);
    expect(deleteCalls.messages ?? 0).toBe(0);
  });
});

describe("jeder Ausstieg, bei dem der Zug etwas gekostet hat, behält die Reservierungen", () => {
  it("normaler Abschluss", async () => {
    const body = await text(await POST(req()));
    expect(body).toContain("event: done");
    expect(calls(monthlyRelease)).toBe(0);
    expect(calls(budgetRelease)).toBe(0);
  });

  it("Abbruch MIT Teiltext: der Teiltext wird gesichert und nichts zurückgegeben", async () => {
    const controller = new AbortController();
    chatCompleteStream.mockImplementation(async function* () {
      yield "halbe ";
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    await text(await POST(req(undefined, controller.signal)));
    expect(calls(monthlyRelease)).toBe(0);
    expect(calls(budgetRelease)).toBe(0);
    expect(insertCalls.messages?.some((r) => (r as { role?: string }).role === "assistant")).toBe(true);
  });

  it("Speichern der Antwort scheitert: der Nutzer hat sie, also bleibt es berechnet; done trägt einen Code, keine Meldung", async () => {
    failAssistantInsert = true;
    const body = await text(await POST(req()));
    expect(body).toContain("event: done");
    expect(body).toContain('"persistError":"persist_failed"');
    expect(body).not.toContain("insert failed");
    expect(calls(monthlyRelease)).toBe(0);
    expect(calls(budgetRelease)).toBe(0);
  });
});

describe("Redis nicht erreichbar: es gibt nichts zurückzugeben, und nichts bricht", () => {
  it("ohne Reservierungen läuft der Zug, ein Fehler gibt nichts zurück", async () => {
    reserveMonthlyQuota.mockImplementation(async () => null);
    reserveServerKeyCall.mockImplementation(async () => null);
    chatCompleteStream.mockImplementation(async function* () {
      throw new Error("Z.ai 500: down");
    });
    const body = await text(await POST(req()));
    expect(body).toContain("event: error");
    expect(calls(monthlyRelease)).toBe(0);
    expect(calls(budgetRelease)).toBe(0);
  });
});

// ─── Der Vertrag des Stroms (#210) ───────────────────────────────────────────

// Jede Nutzlast, die reply-stream wirklich sendet, besteht das Schema in shared/lib/chat-stream.ts:
// meta zuerst, status nur vor dem ersten Wort, genau ein Abschluss (done oder error). Der Typ von `send`
// verhindert falsche Nutzlasten schon beim Übersetzen; dieser Test fängt, wenn der Sender sie an anderer
// Stelle zusammenbaut oder das Schema und der Sender auseinanderlaufen.
describe("Vertrag des Antwort-Stroms", () => {
  function frames(body: string): { event: string; data: unknown }[] {
    return body
      .split("\n\n")
      .filter(Boolean)
      .map((block) => {
        const event = /^event: (.*)$/m.exec(block)?.[1] ?? "";
        const data = /^data: (.*)$/m.exec(block)?.[1] ?? "";
        return { event, data: JSON.parse(data) };
      });
  }

  async function sent(): Promise<{ event: string; data: unknown }[]> {
    const list = frames(await text(await POST(req())));
    for (const { event, data } of list) {
      expect(Object.keys(chatStreamSchemas), `unbekanntes Ereignis ${event}`).toContain(event);
      const result = chatStreamSchemas[event as ChatStreamEventName].safeParse(data);
      expect(result.success, `${event}: ${JSON.stringify(data)}`).toBe(true);
    }
    return list;
  }

  it("Erfolg: meta, delta, done", async () => {
    const list = await sent();
    expect(list.map((f) => f.event)).toEqual(["meta", "delta", "done"]);
    expect(list.at(-1)?.data).toMatchObject({ mode: "generated", conversationId: "conv-1" });
  });

  it("Wiederholung vor dem ersten Wort: status zwischen meta und delta", async () => {
    chatCompleteStream.mockImplementation(async function* (opts: { onRetry: (e: unknown) => void }) {
      opts.onRetry({ failedAttempt: 1, maxAttempts: 3 });
      yield "Hallo";
    });
    const list = await sent();
    expect(list.map((f) => f.event)).toEqual(["meta", "status", "delta", "done"]);
    expect(list[1].data).toEqual({ phase: "retrying", attempt: 2, maxAttempts: 3 });
  });

  it("Anbieterfehler: meta, error, kein done", async () => {
    chatCompleteStream.mockImplementation(async function* () {
      throw new Error("Z.ai 500: down");
    });
    expect((await sent()).map((f) => f.event)).toEqual(["meta", "error"]);
  });

  it("Speichern scheitert: done trägt den Code persistError", async () => {
    failAssistantInsert = true;
    const list = await sent();
    expect(list.at(-1)?.data).toMatchObject({ persistError: "persist_failed" });
  });

  it("Stub ohne Anbieter: meta, delta, done mit mode stub", async () => {
    llmConfig.mockReturnValue(null);
    const list = await sent();
    expect(list.map((f) => f.event)).toEqual(["meta", "delta", "done"]);
    expect(list.at(-1)?.data).toMatchObject({ mode: "stub" });
  });
});

// ─── Datenbank-Lesefehler sind kein "kein Treffer" (#202) ────────────────────

// supabase-js wirft bei einem Fehler nicht. Ein Lesefehler, der als "nichts da" gelesen wird, wäre eine falsche
// Fachentscheidung: Plan Free statt Pro, ein Zug auf dem Server-Key statt dem eigenen, kein Monatskontingent ohne Redis,
// eine neue Konversation statt der laufenden, ein Chat ohne sein Projekt. Jeder dieser Ausstiege antwortet mit 503,
// gibt zurück, was schon reserviert war, und fragt das Modell nie.
describe("Datenbank-Lesefehler", () => {
  const readError = { message: "connection reset" };
  const refused = async () => {
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(calls(chatCompleteStream)).toBe(0);
    return res;
  };

  it("Profil nicht lesbar: nicht Plan Free, sondern 503, noch bevor etwas reserviert wird", async () => {
    tableResults.profiles = { data: null, error: readError };
    await refused();
    expect(calls(reserveMonthlyQuota)).toBe(0);
    expect(calls(reserveServerKeyCall)).toBe(0);
    expect(calls(rateLimit)).toBe(0);
  });

  it("eigener Key nicht lesbar: nicht der Server-Key, sondern 503 vor jeder Reservierung", async () => {
    const { DatabaseReadError } = await import("@/server/supabase/query");
    getUserOverride.mockImplementation(async () => {
      throw new DatabaseReadError("user_api_keys", readError);
    });
    await refused();
    expect(calls(reserveMonthlyQuota)).toBe(0);
    expect(calls(reserveServerKeyCall)).toBe(0);
  });

  it("ohne Redis und mit Zählfehler: nicht 0 Nachrichten, sondern 503", async () => {
    reserveMonthlyQuota.mockImplementation(async () => null);
    tableResults.messages = { data: null, error: readError, count: 0 };
    await refused();
    expect(calls(reserveServerKeyCall)).toBe(0);
  });

  it("laufende Konversation nicht lesbar: keine neue, sondern 503; beide Reservierungen gehen zurück", async () => {
    tableResults.conversations = { data: null, error: readError };
    const res = await POST(
      req({ conversationId: "11111111-1111-4111-8111-111111111111", messages: [{ role: "user", content: "Hi" }] })
    );
    expect(res.status).toBe(503);
    expect(calls(chatCompleteStream)).toBe(0);
    expect(calls(monthlyRelease)).toBe(1);
    expect(calls(budgetRelease)).toBe(1);
    expect(insertCalls.conversations ?? []).toHaveLength(0);
  });

  it("Projekt nicht lesbar: kein Chat ohne Projektkontext, sondern 503; beide Reservierungen gehen zurück", async () => {
    tableResults.projects = { data: null, error: readError };
    const res = await POST(
      req({ projectId: "22222222-2222-4222-8222-222222222222", messages: [{ role: "user", content: "Hi" }] })
    );
    expect(res.status).toBe(503);
    expect(calls(chatCompleteStream)).toBe(0);
    expect(calls(monthlyRelease)).toBe(1);
    expect(calls(budgetRelease)).toBe(1);
    expect(insertCalls.conversations ?? []).toHaveLength(0);
  });

  it("Tagesbudget und Stundengrenze werden gar nicht erst erreicht, wenn das Profil fehlt", async () => {
    tableResults.profiles = { data: null, error: readError };
    await POST(req());
    expect(log).not.toContain("rateLimit");
    expect(log).not.toContain("reserveServerKeyCall");
  });
});
