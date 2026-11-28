// Stellvertreter für die Dienste, die der Server der Browser-Tests nicht erreichen darf: GitHub (Projekt-Gedächtnis),
// OpenAI (der eigene Key eines Kontos) und Resend (Kontaktformular). outbound-fakes.cjs hängt sie im Server-Prozess
// vor fetch, die Browser-Tests nutzen dieselben Konstanten, und tests/guards/e2e-fakes.test.ts prüft sie gegen den
// Code der App. CommonJS, damit `node --require` und beide Test-Läufer sie laden.
"use strict";

/** Das Repo, das es gibt. Jedes andere beantwortet der Stellvertreter wie GitHub: 404. */
const REPO = {
  owner: "e2e-beispiel",
  name: "rezepte",
  url: "https://github.com/e2e-beispiel/rezepte",
  sha: "a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0",
};
const MISSING_REPO_URL = "https://github.com/e2e-beispiel/gibt-es-nicht";

/** Steht in der README des Repos: die Antwort des Modells nennt nur dann den Repo-Stand, wenn sie ankam. */
const REPO_MARKER = "E2E-Marke Rezeptverwaltung";
/** Gehört in eine hochgeladene Projektdatei, aus demselben Grund. */
const FILE_MARKER = "E2E-Marke Küchenplan";

/** Der Key, den der Stellvertreter von OpenAI annimmt. Kein echter Key: bei OpenAI gibt es ihn nicht. */
const OPENAI_KEY = "sk-proj-e2e-stellvertreter-0000000000000000";
/** Der Key, mit dem der Server der Tests sendet (RESEND_API_KEY). Kein echter Key. */
const RESEND_KEY = "re_e2e_stellvertreter";
/** Eine Nachricht mit diesem Wort lehnt der Stellvertreter von Resend ab. */
const RESEND_FAIL_MARKER = "E2E-RESEND-FAIL";

/** Die Hosts, die nie das Netz erreichen. */
const FAKED_HOSTS = ["api.github.com", "raw.githubusercontent.com", "api.openai.com", "api.resend.com"];

const REPO_FILES = {
  "README.md": `# Rezepte\n\n${REPO_MARKER}: sammelt Rezepte und plant die Woche.\n`,
  "package.json": JSON.stringify({ name: "rezepte", dependencies: { next: "^16.0.0", react: "^19.0.0" } }, null, 2),
  "src/app.ts": "export const app = 'rezepte';\n",
};

const json = (status, value) => ({
  status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(value),
});

function github(url, method) {
  const base = `/repos/${REPO.owner}/${REPO.name}`;
  if (method === "GET" && url.pathname === base) {
    return json(200, {
      default_branch: "main",
      description: "Rezepte sammeln und die Woche planen",
      language: "TypeScript",
      topics: ["kochen"],
    });
  }
  if (method === "GET" && (url.pathname === `${base}/git/trees/main` || url.pathname === `${base}/git/trees/HEAD`)) {
    return json(200, {
      sha: REPO.sha,
      truncated: false,
      tree: Object.entries(REPO_FILES).map(([path, content]) => ({ path, type: "blob", size: Buffer.byteLength(content) })),
    });
  }
  return json(404, { message: "Not Found" });
}

function githubRaw(url, method) {
  const prefix = `/${REPO.owner}/${REPO.name}/main/`;
  const path = url.pathname.startsWith(prefix) ? decodeURIComponent(url.pathname.slice(prefix.length)) : "";
  if (method !== "GET" || !Object.hasOwn(REPO_FILES, path)) return { status: 404, headers: {}, body: "404: Not Found" };
  return { status: 200, headers: { "content-type": "text/plain; charset=utf-8" }, body: REPO_FILES[path] };
}

/** Die Fakten, die das "Modell" aus dem ableitet, was wirklich in seiner Anfrage steht. */
function factsFrom(text) {
  const repo = text.includes(REPO_MARKER);
  const next = text.includes('"next"');
  const file = text.includes(FILE_MARKER);
  return {
    summary: repo ? "Rezeptverwaltung aus dem Beispiel-Repo." : "Keine Quelle aus dem Repo erkannt.",
    language: repo ? "TypeScript" : "",
    framework: next ? "Next.js 16" : "",
    stack: next ? ["Next.js", "React"] : [],
    keyFacts: file ? ["Küchenplan aus der hochgeladenen Datei"] : [],
    confidence: next ? "high" : "low",
  };
}

function openai(url, method, headers, body) {
  if (headers.authorization !== `Bearer ${OPENAI_KEY}`) {
    return json(401, { error: { message: "Incorrect API key provided", type: "invalid_request_error" } });
  }
  if (method !== "POST" || url.pathname !== "/v1/chat/completions") return json(404, { error: { message: "not faked" } });
  const request = JSON.parse(body);
  if (request.stream) return json(400, { error: { message: "streaming is not faked" } });
  // Der Text aller Nachrichten, auch aus den Teilen einer Nachricht mit Bildern.
  const text = request.messages
    .flatMap((m) => (Array.isArray(m.content) ? m.content.map((part) => part.text ?? "") : [m.content]))
    .join("\n");
  // Die Analyse verlangt ein JSON-Objekt, die Prüfung eines neuen Keys nur ein Wort.
  const analysis = text.includes("Projekt: ");
  return json(200, {
    id: "chatcmpl-e2e",
    object: "chat.completion",
    created: 0,
    model: request.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: analysis ? JSON.stringify(factsFrom(text)) : "OK" },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
}

function resend(url, method, headers, body) {
  if (headers.authorization !== `Bearer ${RESEND_KEY}`) return json(401, { message: "API key is invalid" });
  if (method !== "POST" || url.pathname !== "/emails") return json(404, { message: "not faked" });
  if (String(JSON.parse(body).text).includes(RESEND_FAIL_MARKER)) return json(500, { message: "Internal server error" });
  return json(200, { id: "e2e-mail" });
}

const HANDLERS = {
  "api.github.com": github,
  "raw.githubusercontent.com": githubRaw,
  "api.openai.com": openai,
  "api.resend.com": resend,
};

/**
 * Die Antwort des Stellvertreters, oder null für jeden anderen Host: dann geht die Anfrage normal raus.
 * `headers` mit kleingeschriebenen Namen, `body` als Text.
 */
function fakeResponse(rawUrl, method, headers, body) {
  const url = new URL(rawUrl);
  if (!Object.hasOwn(HANDLERS, url.hostname)) return null;
  return HANDLERS[url.hostname](url, method.toUpperCase(), headers, body);
}

module.exports = {
  FAKED_HOSTS,
  FILE_MARKER,
  MISSING_REPO_URL,
  OPENAI_KEY,
  REPO,
  REPO_MARKER,
  RESEND_FAIL_MARKER,
  RESEND_KEY,
  fakeResponse,
};
