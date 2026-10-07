import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// Vertrag der Eingabeprüfung (Betriebs-Audit, Folgesitzung 2026-10-07, Teil F, zod 4): was ein Aufrufer von
// POST /api/auth für jede Eingabe zurückbekommt, Statuscode und die GANZE Antwort (Feldpfade und Meldungen von
// zod). Die Fälle stehen in route.validation.cases.json, aufgenommen gegen zod 3.25.76
// (`RECORD_VALIDATION=1 npx vitest run <diese Datei>`). Auch die Strenge von `.email()` ist hier festgehalten.

const CASES_FILE = fileURLToPath(new URL("./route.validation.cases.json", import.meta.url));
type Case = { name: string; body: unknown; raw?: string; status?: number; response?: unknown };
const recorded: Case[] = JSON.parse(readFileSync(CASES_FILE, "utf8"));

const signInWithPassword = vi.fn();
const signUp = vi.fn();
const resend = vi.fn();
const resetPasswordForEmail = vi.fn();
const rateLimit = vi.fn();
const verifyTurnstileToken = vi.fn();

vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      signUp: (...a: unknown[]) => signUp(...a),
      resend: (...a: unknown[]) => resend(...a),
      resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmail(...a),
    },
  }),
}));
vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: () => "ip:203.0.113.7",
  clientIp: () => "203.0.113.7",
}));
vi.mock("@/server/security/turnstile", () => ({
  verifyTurnstileToken: (...a: unknown[]) => verifyTurnstileToken(...a),
  MAX_TURNSTILE_TOKEN_CHARS: 4096,
}));
vi.mock("@/shared/lib/observability", () => ({ logWarning: vi.fn(), captureError: vi.fn() }));

function request(c: Case) {
  return new Request("https://promptprinter.app/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: c.raw !== undefined ? c.raw : JSON.stringify(c.body),
  });
}

function reset() {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetAt: Date.now() + 1000 });
  verifyTurnstileToken.mockResolvedValue({ ok: true, skipped: false });
  signInWithPassword.mockResolvedValue({ error: null });
  signUp.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
  resend.mockResolvedValue({ error: null });
  resetPasswordForEmail.mockResolvedValue({ error: null });
}
beforeEach(reset);

describe("POST /api/auth: Antworten auf Eingaben (Vertrag)", () => {
  if (process.env.RECORD_VALIDATION === "1") {
    it("nimmt die Antworten auf", async () => {
      const out: Case[] = [];
      for (const c of recorded) {
        reset();
        const res = await POST(request(c));
        out.push({ name: c.name, body: c.body, ...(c.raw !== undefined ? { raw: c.raw } : {}), status: res.status, response: await res.json() });
      }
      writeFileSync(CASES_FILE, JSON.stringify(out, null, 2) + "\n");
    });
    return;
  }

  for (const c of recorded) {
    it(c.name, async () => {
      const res = await POST(request(c));
      expect(res.status).toBe(c.status);
      expect(await res.json()).toEqual(c.response);
    });
  }

  it("hat Fälle (der Vertrag ist nicht leer)", () => {
    expect(recorded.length).toBeGreaterThanOrEqual(60);
  });
});
