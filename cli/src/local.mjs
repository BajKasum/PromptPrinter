import { ConfigError, isLocalHost } from "./config.mjs";
import { FINN_SYSTEM_PROMPT } from "./finn-prompt.mjs";
import { parseSse } from "./sse.mjs";
import { sanitize } from "./text.mjs";

// Ohne Konto (`--local`): das Programm spricht selbst mit einem Modell, über die Chat-Schnittstelle von OpenAI
// (`/chat/completions`), die Ollama, LM Studio, llama.cpp, vLLM und OpenRouter gleich anbieten. Finns Regeln
// kommen aus finn-prompt.mjs, PromptPrinter ist nicht beteiligt.
export const DEFAULT_LOCAL_URL = "http://localhost:11434/v1";
const REQUEST_TIMEOUT_MS = 20_000;
// Ein Modell auf dem eigenen Rechner lädt beim ersten Zug erst und liest dann Finns Regeln, auf einer CPU
// dauert das Minuten. Danach kommen die Stücke in kurzen Abständen.
const IDLE_TIMEOUT_MS = 300_000;
const OPEN = "<think>";
const CLOSE = "</think>";

/** Der Endpunkt hat nicht geantwortet (läuft nicht, falsche Adresse, Umleitung). */
export class LocalUnreachableError extends Error {}

/** Der Endpunkt hat abgesagt, mit HTTP-Status. Der Text kommt von fremd und ist bereinigt. */
export class LocalModelError extends Error {
  constructor(status, detail) {
    super(detail ? sanitize(detail) : `HTTP ${status}`);
    this.status = status;
  }
}

/**
 * Adresse, Modell und Key aus `--base-url`, `--model` und der Umgebung. Der Key nur aus
 * PROMPTPRINTER_API_KEY: als Argument stünde er in der Shell-Historie und in der Prozessliste. https ist
 * Pflicht, http nur auf dem eigenen Rechner, denn mit dem Text geht oft ein Key mit.
 */
export function localSettings(flags = {}, env = process.env) {
  const raw = (flags.baseUrl ?? env.PROMPTPRINTER_BASE_URL ?? "").trim() || DEFAULT_LOCAL_URL;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError(`--base-url is not a valid address: ${sanitize(raw)}`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new ConfigError("--base-url takes no user, password, query or #. Put a key into PROMPTPRINTER_API_KEY.");
  }
  const onThisComputer = isLocalHost(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && onThisComputer)) {
    throw new ConfigError(`--base-url must use https (http only on this computer): ${sanitize(raw)}`);
  }
  return {
    baseUrl: `${url.origin}${url.pathname.replace(/\/+$/, "")}`,
    host: url.host,
    onThisComputer,
    model: (flags.model ?? env.PROMPTPRINTER_MODEL ?? "").trim() || null,
    apiKey: env.PROMPTPRINTER_API_KEY?.trim() || null,
  };
}

/**
 * `--local [--model <Name>] [--base-url <Adresse>]`, auch als `--model=<Name>`. Alles andere (auch ein
 * `--api-key`) ist ein Fehler: dann null, und der Aufrufer zeigt die Hilfe.
 */
export function parseLocalArgs(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg : arg.slice(0, eq);
    if (name !== "--model" && name !== "--base-url") return null;
    const value = eq === -1 ? args[++i] : arg.slice(eq + 1);
    if (value === undefined || value.trim() === "" || value.startsWith("--")) return null;
    flags[name === "--model" ? "model" : "baseUrl"] = value;
  }
  return flags;
}

/**
 * Der Zugang zum Endpunkt. `redirect: "error"`: mit der Anfrage geht ein Key und Finns ganzer Verlauf, beides
 * nur an die Adresse, die der Nutzer genannt hat. Den Key bekommt nur dieser Endpunkt, und nur wenn es einen gibt.
 */
export function createLocalModel({ baseUrl, model = null, apiKey = null, version, fetch: doFetch = globalThis.fetch }) {
  const headers = { "user-agent": `promptprinter-cli/${version}` };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  async function send(method, path, { body, signal }) {
    try {
      return await doFetch(`${baseUrl}${path}`, {
        method,
        headers: body === undefined ? headers : { ...headers, "content-type": "application/json" },
        redirect: "error",
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (err?.name === "AbortError" && signal?.aborted && signal.reason?.name !== "TimeoutError") throw err;
      throw new LocalUnreachableError(err?.message ?? "fetch failed", { cause: err });
    }
  }

  async function failure(res) {
    const text = await res.text().catch(() => "");
    let detail = text;
    try {
      const json = JSON.parse(text);
      const error = json?.error;
      detail = typeof error === "string" ? error : (error?.message ?? json?.detail ?? json?.message ?? text);
    } catch {
      // kein JSON: der Text selbst
    }
    return new LocalModelError(res.status, String(detail).slice(0, 300));
  }

  return {
    baseUrl,
    model,
    /** Die Namen der Modelle, die der Endpunkt anbietet. */
    async listModels() {
      const res = await send("GET", "/models", { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) throw await failure(res);
      const body = await res.json().catch(() => null);
      const list = Array.isArray(body?.data) ? body.data : [];
      return list
        .map((entry) => entry?.id)
        .filter((id) => typeof id === "string" && id.trim() !== "")
        .map((id) => sanitize(id));
    },
    /** Gibt die Antwort mit offenem Strom zurück. Eine Absage wirft, bevor ein Wort gelesen wird. */
    async chat(messages, signal) {
      const body = { model, stream: true, messages: [{ role: "system", content: FINN_SYSTEM_PROMPT }, ...messages] };
      const res = await send("POST", "/chat/completions", { body, signal });
      if (!res.ok) throw await failure(res);
      return res;
    },
  };
}

/** Das genannte Modell, sonst das einzige, das der Endpunkt anbietet. Bei mehreren entscheidet der Nutzer. */
export async function chooseModel(endpoint, settings) {
  if (settings.model) return { kind: "ok", model: settings.model };
  const models = await endpoint.listModels();
  if (models.length === 1) return { kind: "ok", model: models[0] };
  return models.length === 0 ? { kind: "none" } : { kind: "many", models };
}

/**
 * Liest den Strom von `/chat/completions`: je Stück `data: {json}`, am Ende `data: [DONE]`. Nur `content` ist
 * Antwort; Denken, das ein Server getrennt schickt (`reasoning`), bleibt weg. Fehlt `[DONE]`, zählt ein
 * gemeldetes `finish_reason` als Ende, sonst ist die Verbindung abgerissen.
 */
export async function* readCompletion(stream) {
  let finished = false;
  for await (const { data } of parseSse(stream)) {
    if (data.trim() === "[DONE]") {
      yield { kind: "done" };
      return;
    }
    let json;
    try {
      json = JSON.parse(data);
    } catch {
      yield { kind: "invalid" };
      return;
    }
    if (json?.error) {
      const error = json.error;
      yield { kind: "error", detail: String(typeof error === "string" ? error : (error.message ?? "error")) };
      return;
    }
    const choice = Array.isArray(json?.choices) ? json.choices[0] : undefined;
    if (!choice) continue;
    const content = choice.delta?.content;
    if (typeof content === "string" && content !== "") yield { kind: "text", text: content };
    if (choice.finish_reason) finished = true;
  }
  yield { kind: finished ? "done" : "dropped" };
}

/**
 * Denkende Modelle (Qwen3, DeepSeek-R1) schreiben bei manchen Servern ihr Denken als `<think>…</think>` vor
 * die Antwort. Das ist nicht Finns Antwort und geht nicht auf den Bildschirm. Die Marke kann über mehrere
 * Stücke verteilt kommen, deshalb hält der Filter zurück, was noch zu einer werden könnte.
 */
export function createThinkFilter() {
  let state = "start";
  let buffer = "";
  return {
    push(text) {
      buffer += text;
      for (;;) {
        if (state === "open") {
          const out = buffer;
          buffer = "";
          return out;
        }
        if (state === "start") {
          const trimmed = buffer.trimStart();
          if (OPEN.startsWith(trimmed)) return "";
          if (trimmed.startsWith(OPEN)) {
            buffer = trimmed.slice(OPEN.length);
            state = "thinking";
          } else {
            state = "open";
          }
          continue;
        }
        if (state === "thinking") {
          const end = buffer.indexOf(CLOSE);
          if (end === -1) {
            buffer = buffer.slice(-(CLOSE.length - 1));
            return "";
          }
          buffer = buffer.slice(end + CLOSE.length);
          state = "afterThinking";
          continue;
        }
        buffer = buffer.replace(/^\s+/, "");
        if (buffer === "") return "";
        state = "open";
      }
    },
    /** Am Ende: was am Anfang zurückgehalten wurde und doch keine Marke war, ist Antwort. */
    flush() {
      const out = state === "start" ? buffer : "";
      buffer = "";
      return out;
    },
  };
}

/**
 * Ein Zug ohne Konto, mit denselben Ergebnissen wie `runTurn` in chat.mjs. Dazu `empty`: das Modell hat
 * nichts geschrieben (oder nur gedacht). Text wird beim Lesen bereinigt und bleibt so im Verlauf.
 */
export async function runLocalTurn({ endpoint, conversation, text, onDelta, signal }) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal?.addEventListener("abort", stop, { once: true });
  let idle;
  const arm = () => {
    clearTimeout(idle);
    idle = setTimeout(stop, IDLE_TIMEOUT_MS);
  };
  const filter = createThinkFilter();
  let reply = "";
  const emit = (raw) => {
    const clean = sanitize(raw);
    if (!clean) return;
    reply += clean;
    onDelta?.(clean);
  };

  try {
    arm();
    const response = await endpoint.chat(conversation.request(text).messages, controller.signal);
    for await (const part of readCompletion(response.body)) {
      arm();
      if (part.kind === "text") emit(filter.push(part.text));
      else if (part.kind === "invalid") return { kind: "protocol", text: reply };
      else if (part.kind === "error") return { kind: "error", text: reply, detail: sanitize(part.detail) };
      else if (part.kind === "dropped") return { kind: "dropped", text: reply };
      else {
        emit(filter.flush());
        if (!reply.trim()) return { kind: "empty", text: reply };
        conversation.commit(text, reply);
        return { kind: "done", text: reply, persistError: null };
      }
    }
    return { kind: "dropped", text: reply };
  } catch (err) {
    if (controller.signal.aborted) return { kind: signal?.aborted ? "stopped" : "dropped", text: reply };
    if (reply) return { kind: "dropped", text: reply };
    throw err;
  } finally {
    clearTimeout(idle);
    signal?.removeEventListener("abort", stop);
  }
}

/** Aus einer Absage des Endpunkts ein Satz, der weiterhilft. */
export function describeLocalError(err, { t, settings }) {
  const url = settings.baseUrl;
  if (err instanceof LocalUnreachableError) {
    return t(url === DEFAULT_LOCAL_URL ? "localNoOllama" : "localUnreachable", { url });
  }
  if (err instanceof LocalModelError) {
    if (err.status === 401 || err.status === 403) return t("localAuth", { url });
    if (err.status === 404) return t("localNotFound", { url, model: settings.model ?? "?" });
    if (err.status === 429) return t("localRateLimited");
    return t("generic", { detail: err.message });
  }
  return t("generic", { detail: sanitize(String(err?.message ?? err)) });
}
