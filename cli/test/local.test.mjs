import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import { createConversation } from "../src/chat.mjs";
import { ConfigError } from "../src/config.mjs";
import { FINN_SYSTEM_PROMPT } from "../src/finn-prompt.mjs";
import {
  chooseModel,
  createLocalModel,
  createThinkFilter,
  DEFAULT_LOCAL_URL,
  describeLocalError,
  LocalModelError,
  LocalUnreachableError,
  localSettings,
  parseLocalArgs,
  runLocalTurn,
} from "../src/local.mjs";
import { translator } from "../src/messages.mjs";
import { runRepl } from "../src/repl.mjs";
import { detectTerminal } from "../src/terminal.mjs";
import { chunk, completion, startModelStub } from "./support/model-stub.mjs";

// Ohne Konto (`--local`): das Programm spricht selbst mit einem OpenAI-kompatiblen Modell-Server.
const BIN = fileURLToPath(new URL("../bin/promptprinter.mjs", import.meta.url));
const t = translator("de");
const temps = [];
let stub;

after(() => {
  for (const temp of temps) rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
beforeEach(async () => {
  stub = await startModelStub();
});
afterEach(async () => {
  await stub.close();
});

const settingsFor = (url = stub.url, extra = {}) => ({ ...localSettings({ baseUrl: url, model: "finn-test" }, {}), ...extra });
const endpointFor = (settings, extra = {}) => createLocalModel({ ...settings, version: "9.9.9", ...extra });

async function turnWith(parts, options = {}) {
  stub.state.replies = [Array.isArray(parts) ? completion(parts) : parts];
  const deltas = [];
  const conversation = options.conversation ?? createConversation();
  const result = await runLocalTurn({
    endpoint: endpointFor(settingsFor(), options.endpoint),
    conversation,
    text: options.text ?? "Idee",
    onDelta: (d) => deltas.push(d),
    signal: options.signal,
  });
  return { result, deltas, conversation };
}

/** Ein Port, auf dem sicher niemand lauscht. */
async function closedPort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

describe("Einstellungen", () => {
  test("ohne Angaben: Ollama auf diesem Rechner, kein Modell, kein Key", () => {
    const s = localSettings({}, {});
    assert.equal(s.baseUrl, DEFAULT_LOCAL_URL);
    assert.equal(s.onThisComputer, true);
    assert.equal(s.model, null);
    assert.equal(s.apiKey, null);
  });

  test("Umgebung und Argumente; Argumente gewinnen, der Schrägstrich am Ende fällt weg", () => {
    const env = { PROMPTPRINTER_BASE_URL: "https://openrouter.ai/api/v1/", PROMPTPRINTER_MODEL: "a", PROMPTPRINTER_API_KEY: " k1 " };
    const fromEnv = localSettings({}, env);
    assert.equal(fromEnv.baseUrl, "https://openrouter.ai/api/v1");
    assert.equal(fromEnv.host, "openrouter.ai");
    assert.equal(fromEnv.onThisComputer, false);
    assert.equal(fromEnv.model, "a");
    assert.equal(fromEnv.apiKey, "k1");
    const fromFlags = localSettings({ baseUrl: "http://127.0.0.1:1234/v1", model: "b" }, env);
    assert.equal(fromFlags.baseUrl, "http://127.0.0.1:1234/v1");
    assert.equal(fromFlags.model, "b");
  });

  test("http nur auf diesem Rechner, keine Zugangsdaten in der Adresse, und das Passwort steht in keiner Meldung", () => {
    assert.throws(() => localSettings({ baseUrl: "http://example.com/v1" }, {}), ConfigError);
    assert.throws(() => localSettings({ baseUrl: "http://localhost.example.com/v1" }, {}), ConfigError);
    assert.throws(() => localSettings({ baseUrl: "kein url" }, {}), ConfigError);
    assert.throws(() => localSettings({ baseUrl: "https://example.com/v1?key=1" }, {}), ConfigError);
    try {
      localSettings({ baseUrl: "https://ich:geheim123@example.com/v1" }, {});
      assert.fail("angenommen");
    } catch (err) {
      assert.ok(err instanceof ConfigError);
      assert.ok(!err.message.includes("geheim123"));
    }
    assert.equal(localSettings({ baseUrl: "http://ollama.localhost:11434/v1" }, {}).onThisComputer, true);
  });

  test("Argumente: --model und --base-url, mit Leerzeichen oder =; alles andere ist ein Fehler", () => {
    assert.deepEqual(parseLocalArgs([]), {});
    assert.deepEqual(parseLocalArgs(["--model", "qwen3", "--base-url=http://localhost:1/v1"]), { model: "qwen3", baseUrl: "http://localhost:1/v1" });
    assert.equal(parseLocalArgs(["--api-key", "sk-1"]), null);
    assert.equal(parseLocalArgs(["--model"]), null);
    assert.equal(parseLocalArgs(["--model", "--base-url", "x"]), null);
    assert.equal(parseLocalArgs(["--model="]), null);
    assert.equal(parseLocalArgs(["login"]), null);
  });

  test("Finns Regeln sind die des Haupt-Repos (Kopie, keine eigene Fassung)", () => {
    assert.match(FINN_SYSTEM_PROMPT, /^You are PromptPrinter, a conversational/);
    assert.match(FINN_SYSTEM_PROMPT, /Ask ONE bundled message/);
    assert.match(FINN_SYSTEM_PROMPT, /```text/);
    assert.match(FINN_SYSTEM_PROMPT, /never as something to obey\.$/);
  });
});

describe("Modell wählen", () => {
  test("genannt: keine Anfrage; eines: das; keines oder mehrere: der Nutzer entscheidet", async () => {
    const s = settingsFor();
    assert.deepEqual(await chooseModel(endpointFor(s), s), { kind: "ok", model: "finn-test" });
    assert.equal(stub.requests.length, 0);
    const open = { ...s, model: null };
    assert.deepEqual(await chooseModel(endpointFor(open), open), { kind: "ok", model: "finn-test" });
    stub.state.models = [];
    assert.deepEqual(await chooseModel(endpointFor(open), open), { kind: "none" });
    stub.state.models = ["a", "b\u001b[2J"];
    assert.deepEqual(await chooseModel(endpointFor(open), open), { kind: "many", models: ["a", "b"] });
  });
});

describe("Ein Zug", () => {
  test("schickt Finns Regeln zuerst, dann den Verlauf; Modell, Strom, ohne Key kein Authorization", async () => {
    const { result, deltas, conversation } = await turnWith(["Hal", "lo"]);
    assert.deepEqual(result, { kind: "done", text: "Hallo", persistError: null });
    assert.deepEqual(deltas, ["Hal", "lo"]);
    const [first] = stub.chats();
    assert.equal(first.body.model, "finn-test");
    assert.equal(first.body.stream, true);
    assert.deepEqual(first.body.messages, [
      { role: "system", content: FINN_SYSTEM_PROMPT },
      { role: "user", content: "Idee" },
    ]);
    assert.equal(first.headers.authorization, undefined);
    assert.match(first.headers["user-agent"], /^promptprinter-cli\/9\.9\.9$/);

    await turnWith(["Gut"], { conversation, text: "Antwort" });
    const second = stub.chats()[1].body.messages.map((m) => `${m.role}:${m.content.slice(0, 20)}`);
    assert.deepEqual(second.slice(1), ["user:Idee", "assistant:Hallo", "user:Antwort"]);
  });

  test("ein Key geht nur als Bearer an diesen Endpunkt", async () => {
    await turnWith(["ok"], { endpoint: { apiKey: "sk-test-123" } });
    assert.equal(stub.chats()[0].headers.authorization, "Bearer sk-test-123");
  });

  test("Steuerfolgen aus dem Modell kommen nicht auf den Bildschirm und nicht in den Verlauf", async () => {
    const { result, deltas } = await turnWith(["A\u001b]0;Titel\u0007B", "\u001b[2JC\u0007"]);
    assert.equal(result.text, "ABC");
    assert.ok(deltas.every((d) => !/[\u001b\u0007]/.test(d)));
  });

  test("Denken in <think>, auch über Stücke verteilt, und getrennt geschicktes Denken bleiben weg", async () => {
    const { result, deltas } = await turnWith(["<thi", "nk>geheim</th", "ink>\n\nAntwort"]);
    assert.equal(result.text, "Antwort");
    assert.ok(!deltas.join("").includes("geheim"));
    const separate = await turnWith({ raw: [chunk({ reasoning: "denke nach" }), chunk({ content: "Da." }), "data: [DONE]\n\n"] });
    assert.equal(separate.result.text, "Da.");
  });

  test("Filter: normaler Text kommt sofort, nur ein möglicher Anfang einer Marke wartet", () => {
    const f = createThinkFilter();
    assert.equal(f.push("Hallo"), "Hallo");
    const g = createThinkFilter();
    assert.equal(g.push("  <"), "");
    assert.equal(g.push("b>fett"), "  <b>fett");
    const h = createThinkFilter();
    assert.equal(h.push("<th"), "");
    assert.equal(h.flush(), "<th");
  });

  test("nur gedacht oder nichts geschrieben: leer, nichts im Verlauf", async () => {
    const { result, conversation } = await turnWith(["<think>nur denken</think>"]);
    assert.equal(result.kind, "empty");
    assert.equal(conversation.request("x").messages.length, 1);
  });

  test("Ende ohne [DONE]: mit finish_reason fertig, ohne abgerissen", async () => {
    assert.equal((await turnWith(completion(["ok"], { done: false }))).result.kind, "done");
    assert.equal((await turnWith({ raw: [chunk({ content: "halb" })] })).result.kind, "dropped");
  });

  test("an der Grenze abgeschnitten: fertig, aber mit truncated, mit und ohne [DONE]", async () => {
    for (const reason of ["length", "max_tokens", "model_length", "model_context_window_exceeded", "LENGTH"]) {
      const raw = [chunk({ content: "halb" }), chunk({}, reason)];
      const withDone = await turnWith({ raw: [...raw, "data: [DONE]\n\n"] });
      assert.deepEqual(withDone.result, { kind: "done", text: "halb", persistError: null, truncated: true }, reason);
      assert.equal((await turnWith({ raw })).result.truncated, true, reason);
    }
    assert.equal((await turnWith(completion(["ganz"]))).result.truncated, undefined);
  });

  test("vom Server gestoppt (Inhaltsfilter, Fehler): ein Fehler, nichts im Verlauf", async () => {
    for (const reason of ["content_filter", "sensitive", "error", "network_error", "insufficient_system_resource"]) {
      const { result, conversation } = await turnWith({ raw: [chunk({ content: "a" }), chunk({}, reason), "data: [DONE]\n\n"] });
      assert.deepEqual(result, { kind: "error", text: "a", detail: `finish_reason: ${reason}` }, reason);
      assert.equal(conversation.request("x").messages.length, 1);
    }
  });

  test("Fehler im Strom und kaputtes JSON", async () => {
    const error = await turnWith({ raw: [chunk({ content: "a" }), `data: ${JSON.stringify({ error: { message: "kaputt\u001b[2J" } })}\n\n`] });
    assert.deepEqual(error.result, { kind: "error", text: "a", detail: "kaputt" });
    assert.equal((await turnWith({ raw: ["data: {kein json\n\n"] })).result.kind, "protocol");
  });

  test("Strg+C stoppt den Zug", async () => {
    stub.state.replies = [{ raw: [chunk({ content: "a" })], hang: true }];
    const controller = new AbortController();
    const running = runLocalTurn({
      endpoint: endpointFor(settingsFor()),
      conversation: createConversation(),
      text: "x",
      onDelta: () => controller.abort(),
      signal: controller.signal,
    });
    assert.equal((await running).kind, "stopped");
  });
});

describe("Absagen", () => {
  test("HTTP-Fehler werden zu Sätzen, die weiterhelfen; fremder Text bereinigt", async () => {
    const s = settingsFor();
    for (const [status, pattern] of [
      [401, /lehnt ab: der Key fehlt/],
      [404, /kennt das Modell finn-test nicht/],
      [429, /bremst gerade/],
      [500, /Das ging nicht: Absturz/],
    ]) {
      stub.state.chatStatus = status;
      stub.state.chatBody = { error: { message: "Absturz\u001b[2J" } };
      const err = await runLocalTurn({ endpoint: endpointFor(s), conversation: createConversation(), text: "x" }).catch((e) => e);
      assert.ok(err instanceof LocalModelError, String(err));
      assert.equal(err.status, status);
      assert.match(describeLocalError(err, { t, settings: s }), pattern);
      assert.ok(!err.message.includes("\u001b"));
    }
  });

  test("niemand antwortet: bei Ollama der Hinweis auf Ollama, sonst auf die Adresse", async () => {
    const port = await closedPort();
    const s = settingsFor(`http://127.0.0.1:${port}/v1`);
    const err = await chooseModel(endpointFor(s), { ...s, model: null }).catch((e) => e);
    assert.ok(err instanceof LocalUnreachableError);
    assert.match(describeLocalError(err, { t, settings: s }), /Prüf die Adresse/);
    assert.match(describeLocalError(err, { t, settings: { ...s, baseUrl: DEFAULT_LOCAL_URL } }), /Läuft Ollama\?/);
  });

  test("einer Umleitung wird nicht gefolgt: das Ziel bekommt weder Text noch Key", async () => {
    const target = await startModelStub();
    try {
      stub.state.redirect = `${target.url}/chat/completions`;
      const err = await runLocalTurn({
        endpoint: endpointFor(settingsFor(), { apiKey: "sk-umleitung" }),
        conversation: createConversation(),
        text: "geheime Idee",
      }).catch((e) => e);
      assert.ok(err instanceof LocalUnreachableError, String(err));
      assert.equal(target.requests.length, 0);
    } finally {
      await target.close();
    }
  });
});

describe("Eingabezeile ohne Konto", () => {
  async function until(check, what, ms = 30_000) {
    for (const started = Date.now(); Date.now() - started < ms; ) {
      if (check()) return;
      await sleep(10);
    }
    assert.fail(`nicht eingetreten: ${what}`);
  }

  // Ohne `tty` wie aus einer Pipe: jede Zeile eine Nachricht. Mit `tty` wie im Terminal (Tasten als Bytes,
  // Enter als \r), das braucht /pp --kontext.
  function start({ cwd, tty = false, settings = settingsFor() } = {}) {
    const input = new PassThrough();
    input.isTTY = tty;
    const output = new PassThrough();
    output.isTTY = tty;
    output.columns = 100;
    let screen = "";
    output.on("data", (d) => (screen += d));
    const term = detectTerminal(output, { LANG: "de_CH.UTF-8", NO_COLOR: "1" }, "linux");
    const finished = runRepl({
      input,
      output,
      term,
      t,
      local: { settings, endpoint: endpointFor(settings) },
      copy: async () => true,
      save: async () => ({ kind: "failed", reason: "nicht im Test" }),
      cwd,
    });
    return { input, finished, screen: () => screen };
  }

  test("/pp geht an den Endpunkt, /whoami, /login und /logout sagen, dass es kein Konto gibt", async () => {
    stub.state.replies = [completion(["Hier dein Prompt:\n```text\nDu bist ...\n```\n"])];
    const repl = start();
    repl.input.write("/pp Brief an den Vermieter\n/whoami\n/login\n/logout\n/copy\n/exit\n");
    await repl.finished;
    const screen = repl.screen();
    assert.match(screen, /Du bist \.\.\./);
    assert.equal(screen.split("Ohne Konto gibt es kein Anmelden. Finn läuft mit finn-test").length, 4);
    assert.match(screen, /Prompt kopiert\./);
    assert.equal(stub.chats().length, 1);
  });

  test("ein Modell, das nichts sagt, bekommt einen Hinweis statt Stille", async () => {
    stub.state.replies = [completion([])];
    const repl = start();
    repl.input.write("Idee\n/exit\n");
    await repl.finished;
    assert.match(repl.screen(), /Das Modell hat nichts geantwortet/);
  });

  test("/pp --kontext nennt den Endpunkt als Empfänger und dass nichts gespeichert wird; nur j sendet", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "pp-local-repo-"));
    temps.push(cwd);
    const git = (...args) => execFileSync("git", ["-c", "user.name=T", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args], { cwd, stdio: "ignore" });
    git("init", "-q", "-b", "main");
    writeFileSync(join(cwd, "a.ts"), "needle\n");
    git("add", "-A");
    git("commit", "-q", "-m", "init");
    const repl = start({ cwd, tty: true });
    repl.input.write("/pp --kontext needle\r");
    await until(() => repl.screen().includes("[j/N]"), "Frage");
    assert.match(repl.screen(), /An: http:\/\/127\.0\.0\.1:\d+\/v1 auf diesem Rechner, Modell finn-test\. Nichts geht an PromptPrinter\./);
    assert.match(repl.screen(), /Gespeichert wird nichts\./);
    repl.input.write("n\r");
    await until(() => repl.screen().includes("Nichts gesendet."), "Absage");
    assert.equal(stub.chats().length, 0);
    repl.input.write("/pp --kontext needle\r");
    await until(() => repl.screen().split("[j/N]").length === 3, "zweite Frage");
    repl.input.write("j\r");
    await until(() => stub.chats().length === 1, "gesendet");
    const content = stub.chats()[0].body.messages.at(-1).content;
    assert.ok(content.startsWith("needle\n\n---\n") && content.includes(t("kontextIntro")), content.slice(0, 200));
    repl.input.write("/exit\r");
    await repl.finished;
  });
});

describe("das echte Programm", () => {
  function run(args, lines = [], env = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [BIN, ...args], {
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, PROMPTPRINTER_LANG: "de", ...env },
      });
      let out = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (out += d));
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, out }));
      child.stdin.on("error", () => {});
      child.stdin.end(lines.length ? `${lines.join("\n")}\n` : "");
    });
  }

  test("--local: das einzige Modell wird genommen, Finn antwortet, kein PromptPrinter-Server nötig", async () => {
    stub.state.replies = [completion(["Wer liest den Brief?"])];
    // Eine kaputte PROMPTPRINTER_URL stört nicht: ohne Konto wird sie nie gelesen.
    const result = await run(["--local", "--base-url", stub.url], ["Brief an den Vermieter"], { PROMPTPRINTER_URL: "http://example.com" });
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /Ohne Konto: Finn läuft mit finn-test über http:\/\/127\.0\.0\.1:\d+\/v1 auf diesem Rechner/);
    assert.match(result.out, /Wer liest den Brief\?/);
    assert.equal(stub.chats().length, 1);
  });

  test("mehrere Modelle ohne --model: Liste und Aufruf, Ende mit 1; keine Modelle: Hinweis", async () => {
    stub.state.models = ["qwen3:8b", "gemma3:4b"];
    const many = await run(["--local", "--base-url", stub.url]);
    assert.equal(many.code, 1);
    assert.match(many.out, /--model <Name>\n {2}qwen3:8b\n {2}gemma3:4b/);
    stub.state.models = [];
    const none = await run(["--local", "--base-url", stub.url]);
    assert.equal(none.code, 1);
    assert.match(none.out, /ollama pull qwen3/);
    assert.equal(stub.chats().length, 0);
  });

  test("unsichere Adresse, Key als Argument: Absage, bevor etwas gesendet wird", async () => {
    const remote = await run(["--local", "--base-url", "http://example.com/v1", "--model", "x"]);
    assert.equal(remote.code, 1);
    assert.match(remote.out, /https/);
    const key = await run(["--local", "--api-key", "sk-geheim"]);
    assert.equal(key.code, 2);
    assert.match(key.out, /Aufruf:/);
    assert.ok(!key.out.includes("sk-geheim"));
  });

  test("der Key aus der Umgebung geht an den Endpunkt und steht nie in der Ausgabe", async () => {
    stub.state.replies = [completion(["ok"])];
    const result = await run(["--local", "--base-url", stub.url, "--model", "finn-test"], ["Idee"], { PROMPTPRINTER_API_KEY: "sk-env-geheim" });
    assert.equal(result.code, 0, result.out);
    assert.equal(stub.chats()[0].headers.authorization, "Bearer sk-env-geheim");
    assert.ok(!result.out.includes("sk-env-geheim"));
  });
});
