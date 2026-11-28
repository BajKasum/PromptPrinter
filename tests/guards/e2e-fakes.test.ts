import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { serverEnv } from "../../e2e/support/env";
import {
  FAKED_HOSTS,
  FILE_MARKER,
  MISSING_REPO_URL,
  OPENAI_KEY,
  REPO,
  REPO_MARKER,
  RESEND_FAIL_MARKER,
  RESEND_KEY,
  fakeResponse,
} from "../../e2e/support/fakes.cjs";
import { analyzeProjectBrain } from "@/server/brain/analyze";
import { fetchRepoHeadSha, fetchRepoSnapshot, parseGithubRepoUrl } from "@/server/brain/github";
import { chatComplete } from "@/server/llm";
import { sendMail } from "@/server/mail/resend";

// Die Stellvertreter der Browser-Tests (e2e/support/fakes.cjs) gegen den Code der App, ohne Datenbank und Browser:
// was die App von GitHub, OpenAI und Resend erwartet, liefern sie, sonst scheiterte der Browser-Test erst in CI. Und
// das Vorladen in den Server (outbound-fakes.cjs) greift wirklich.

const standIn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const request = new Request(input, init);
  const body = request.method === "GET" ? "" : await request.text();
  const answer = fakeResponse(request.url, request.method, Object.fromEntries(request.headers), body);
  if (!answer) throw new Error(`Anfrage an einen Host ohne Stellvertreter: ${request.url}`);
  return new Response(answer.body, { status: answer.status, headers: answer.headers });
});

beforeEach(() => {
  standIn.mockClear();
  vi.stubGlobal("fetch", standIn);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const repo = (url: string) => parseGithubRepoUrl(url)!;

describe("GitHub", () => {
  it("liefert dem Import den Stand des Repos samt Dateien", async () => {
    const snapshot = await fetchRepoSnapshot(repo(REPO.url));

    expect(snapshot).toMatchObject({ sha: REPO.sha, defaultBranch: "main", primaryLanguage: "TypeScript" });
    expect(snapshot.files.map((f) => f.path).sort()).toContain("package.json");
    expect(snapshot.files.find((f) => f.path === "README.md")?.content).toContain(REPO_MARKER);
    await expect(fetchRepoHeadSha(repo(REPO.url))).resolves.toBe(REPO.sha);
  });

  it("kennt das andere Repo nicht", async () => {
    await expect(fetchRepoSnapshot(repo(MISSING_REPO_URL))).rejects.toMatchObject({ code: "repo_not_found" });
  });
});

describe("OpenAI", () => {
  const prompt = { system: "Antworte ausschliesslich mit dem einen Wort OK.", messages: [{ role: "user" as const, content: "Test." }] };

  it("bestätigt den Test-Key beim Speichern und lehnt jeden anderen ab", async () => {
    await expect(chatComplete({ ...prompt, override: { provider: "openai", apiKey: OPENAI_KEY } })).resolves.toMatchObject({
      text: "OK",
    });
    await expect(chatComplete({ ...prompt, override: { provider: "openai", apiKey: "sk-falsch" } })).rejects.toThrow("401");
  });

  const analyze = (documents: { label: string; text: string }[]) =>
    analyzeProjectBrain(
      { projectName: "Küchenhelfer", documents, images: [], repo: null },
      { override: { provider: "openai", apiKey: OPENAI_KEY } }
    );

  it("nennt in der Analyse nur, was in der Anfrage stand", async () => {
    const full = await analyze([
      { label: "rezepte/README.md", text: REPO_MARKER },
      { label: "rezepte/package.json", text: '{"dependencies":{"next":"^16.0.0"}}' },
      { label: "kuechenplan.md", text: FILE_MARKER },
    ]);
    expect(full.facts).toMatchObject({
      summary: "Rezeptverwaltung aus dem Beispiel-Repo.",
      stack: ["Next.js", "React"],
      keyFacts: ["Küchenplan aus der hochgeladenen Datei"],
      confidence: "high",
    });

    const empty = await analyze([{ label: "notiz.md", text: "ohne Marke" }]);
    expect(empty.facts).toMatchObject({ summary: "Keine Quelle aus dem Repo erkannt.", stack: [], keyFacts: [] });
  });
});

describe("Resend", () => {
  const mail = { to: "betrieb@example.test", subject: "Kontakt", text: "Hallo" };

  it("nimmt eine Mail mit dem Test-Key an und lehnt die markierte ab", async () => {
    vi.stubEnv("RESEND_API_KEY", RESEND_KEY);
    await expect(sendMail(mail)).resolves.toEqual({ ok: true });
    await expect(sendMail({ ...mail, text: `${RESEND_FAIL_MARKER} bitte` })).resolves.toEqual({ ok: false, reason: "rejected" });
  });

  it("lehnt einen anderen Key ab", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_falsch");
    await expect(sendMail(mail)).resolves.toEqual({ ok: false, reason: "rejected" });
  });
});

describe("Vorladen im Server der Tests", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "pp-fakes-"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("beantwortet die nachgestellten Hosts mit den NODE_OPTIONS der Umgebung und protokolliert die Anfrage", () => {
    vi.stubEnv("E2E_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("E2E_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("E2E_SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubEnv("NODE_OPTIONS", "");
    const log = join(dir, "anfragen.jsonl");
    const script = `
      fetch("https://api.resend.com/emails", {
        method: "POST", headers: { authorization: "Bearer ${RESEND_KEY}" }, body: JSON.stringify({ text: "hallo" })
      }).then(async (res) => process.stdout.write(res.status + " " + (await res.text())));
    `;

    const output = execFileSync(process.execPath, ["-e", script], {
      encoding: "utf8",
      env: { ...process.env, NODE_OPTIONS: serverEnv().NODE_OPTIONS, E2E_OUTBOUND_LOG: log },
    });

    expect(output).toBe('200 {"id":"e2e-mail"}');
    expect(JSON.parse(readFileSync(log, "utf8"))).toEqual({
      host: "api.resend.com",
      method: "POST",
      path: "/emails",
      status: 200,
      body: '{"text":"hallo"}',
    });
  });

  it("lässt andere Hosts in Ruhe", () => {
    expect(FAKED_HOSTS).toEqual(["api.github.com", "raw.githubusercontent.com", "api.openai.com", "api.resend.com"]);
    expect(fakeResponse("http://127.0.0.1:54321/rest/v1/projects", "GET", {}, "")).toBeNull();
    expect(fakeResponse("https://api.z.ai/api/paas/v4/chat/completions", "POST", {}, "{}")).toBeNull();
  });
});
