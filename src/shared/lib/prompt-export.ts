import { filledValue, findPlaceholders, mapPlaceholders, type PlaceholderFill } from "@/shared/lib/placeholders";

// Export eines gespeicherten Prompts für Entwickler: als Anfrage an eine Modell-Schnittstelle (JSON, curl, Python,
// JavaScript) oder als Datei `.prompt.md` mit YAML-Kopf. Rein, ohne Netz: die Funktionen bauen nur Text.
//
// Platzhalter: Ausgefüllte Werte gehen direkt in den Text. Was leer bleibt, wird erst hier zu einer Variable in
// Mustache-Schreibweise (`{{name}}`); Finn selbst schreibt weiter eckige Klammern, die jede KI auch unausgefüllt
// versteht. Als "kein Platzhalter" markierte Klammern bleiben wörtlich stehen.
//
// Rollen: Standard ist der ganze Prompt in einer Nachricht der Rolle `user`, so schreibt ihn Finn und so schickt ihn
// der Probelauf. Auf Wunsch wird der erste Absatz zur Systemnachricht.
//
// Formen der Schnittstellen, gegen die Doku der Anbieter geprüft (Quellen im Changelog, Eintrag zum Export):
// - OpenAI-kompatibel: POST {base}/chat/completions, `Authorization: Bearer`, { model, messages: [{ role, content }] }.
//   Die Rolle `system` verstehen alle kompatiblen Server (Ollama, LM Studio, vLLM, OpenRouter, Z.ai); OpenAI nennt für
//   neuere Modelle `developer` als Nachfolger.
// - Anthropic: POST https://api.anthropic.com/v1/messages, `x-api-key`, `anthropic-version`, { model, max_tokens,
//   system, messages }.
// - Gemini: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent, `x-goog-api-key`,
//   { systemInstruction: { parts }, contents: [{ role, parts: [{ text }] }] }.
// Der Key steht nie im Code, nur als Umgebungsvariable. Das Modell steht als sichtbarer Platzhalter MODEL_NAME da.

export type ExportTarget = "openai" | "anthropic" | "gemini";
export type ExportCode = "curl" | "python" | "javascript";

export const MODEL_PLACEHOLDER = "MODEL_NAME";
export const ANTHROPIC_VERSION = "2026-10-21";
/** Obergrenze der Antwort, die Anthropic verlangt; die anderen Schnittstellen brauchen keine. */
export const ANTHROPIC_MAX_TOKENS = 4096;

/** Die Umgebungsvariable des Keys je Ziel. */
export const KEY_ENV: Record<ExportTarget, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
};
/** Nur OpenAI-kompatibel: die Adresse des Servers, Standard OpenAI selbst. */
export const BASE_URL_ENV = "OPENAI_BASE_URL";
const OPENAI_BASE = "https://api.openai.com/v1";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

export type PromptExportInput = {
  /** Der gespeicherte Prompt, mit seinen eckigen Platzhaltern. */
  prompt: string;
  title: string;
  /** Was im Formular eingetragen ist; fehlt es, werden alle Platzhalter zu Variablen. */
  fill?: PlaceholderFill;
  /** Der erste Absatz wird zur Systemnachricht (nur, wenn danach noch Text kommt). */
  systemFromFirstParagraph?: boolean;
};

export type TemplateVariable = { name: string; label: string };

const GERMAN_LETTERS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss", Ä: "Ae", Ö: "Oe", Ü: "Ue" };

function slug(text: string, separator: string): string {
  return text
    .replace(/[äöüßÄÖÜ]/g, (c) => GERMAN_LETTERS[c])
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, separator)
    .replace(new RegExp(`^${separator}+|${separator}+$`, "g"), "");
}

/** Der Variablenname eines Platzhalters: "[Name des Vermieters]" wird `name_des_vermieters`. */
export function variableName(label: string): string {
  return slug(label, "_") || "wert";
}

/** Der Text mit eingesetzten Werten und `{{name}}` für jeden offenen Platzhalter, dazu die Liste der Variablen. */
export function toTemplate(prompt: string, fill?: PlaceholderFill): { text: string; variables: TemplateVariable[] } {
  const values = fill?.values ?? {};
  const skipped = fill?.skipped ?? new Set<string>();
  const names = new Map<string, string>();
  const taken = new Set<string>();
  const variables: TemplateVariable[] = [];
  for (const p of findPlaceholders(prompt)) {
    if (skipped.has(p.key) || filledValue(p.key, values, skipped) !== null) continue;
    const base = variableName(p.label);
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base}_${n}`;
    taken.add(name);
    names.set(p.key, name);
    variables.push({ name, label: p.label });
  }
  const text = mapPlaceholders(prompt, (p) => {
    const name = names.get(p.key);
    return name ? `{{${name}}}` : filledValue(p.key, values, skipped);
  });
  return { text, variables };
}

/** Trennt den ersten Absatz ab (bis zur ersten Leerzeile). Ohne zweiten Absatz bleibt alles in `user`. */
export function splitFirstParagraph(text: string): { system: string | null; user: string } {
  const match = /\n[ \t]*\n/.exec(text);
  if (!match) return { system: null, user: text };
  const system = text.slice(0, match.index).trim();
  const user = text.slice(match.index + match[0].length).trim();
  return system && user ? { system, user } : { system: null, user: text };
}

/** Hat der Prompt mehr als einen Absatz? Sonst gibt es nichts, das zur Systemnachricht werden könnte. */
export function canSplitSystem(prompt: string): boolean {
  return splitFirstParagraph(prompt.trim()).system !== null;
}

function messagesOf(input: PromptExportInput): { system: string | null; user: string; variables: TemplateVariable[] } {
  const { text, variables } = toTemplate(input.prompt, input.fill);
  const parts = input.systemFromFirstParagraph ? splitFirstParagraph(text.trim()) : { system: null, user: text.trim() };
  return { ...parts, variables };
}

/** Der Rumpf der Anfrage an die Schnittstelle des Ziels. */
export function requestBody(target: ExportTarget, input: PromptExportInput): Record<string, unknown> {
  const { system, user } = messagesOf(input);
  if (target === "anthropic") {
    return {
      model: MODEL_PLACEHOLDER,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: user }],
    };
  }
  if (target === "gemini") {
    return {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: user }] }],
    };
  }
  return {
    model: MODEL_PLACEHOLDER,
    messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }],
  };
}

/** Die Anfrage als JSON, eingerückt. */
export function exportJson(target: ExportTarget, input: PromptExportInput): string {
  return JSON.stringify(requestBody(target, input), null, 2);
}

// Wo die Antwort steht, je Ziel, als Pfad für Python (Schlüssel) und JavaScript (Punkte).
const REPLY_PATH: Record<ExportTarget, (string | number)[]> = {
  openai: ["choices", 0, "message", "content"],
  anthropic: ["content", 0, "text"],
  gemini: ["candidates", 0, "content", "parts", 0, "text"],
};

function curl(target: ExportTarget, body: string): string {
  const head =
    target === "openai"
      ? [
          `curl "\${${BASE_URL_ENV}:-${OPENAI_BASE}}/chat/completions"`,
          `-H "Content-Type: application/json"`,
          `-H "Authorization: Bearer $${KEY_ENV.openai}"`,
        ]
      : target === "anthropic"
        ? [
            `curl ${ANTHROPIC_URL}`,
            `-H "content-type: application/json"`,
            `-H "x-api-key: $${KEY_ENV.anthropic}"`,
            `-H "anthropic-version: ${ANTHROPIC_VERSION}"`,
          ]
        : [
            `curl "${GEMINI_BASE}${MODEL_PLACEHOLDER}:generateContent"`,
            `-H "Content-Type: application/json"`,
            `-H "x-goog-api-key: $${KEY_ENV.gemini}"`,
          ];
  // Der Rumpf kommt als Here-Document mit gequotetem Ende: die Shell ersetzt darin nichts, und eine Zeile, die nur
  // aus JSON besteht, kann in eingerücktem JSON nicht vorkommen (jeder Text steht dort in Anführungszeichen).
  return `${[...head, "--data-binary @- <<'JSON'"].join(" \\\n  ")}\n${body}\nJSON\n`;
}

function python(target: ExportTarget, body: string): string {
  const path = REPLY_PATH[target].map((k) => `[${JSON.stringify(k)}]`).join("");
  const url =
    target === "openai"
      ? `os.environ.get("${BASE_URL_ENV}", "${OPENAI_BASE}") + "/chat/completions"`
      : target === "anthropic"
        ? `"${ANTHROPIC_URL}"`
        : `"${GEMINI_BASE}" + MODEL + ":generateContent"`;
  const headers =
    target === "openai"
      ? [`"Content-Type": "application/json"`, `"Authorization": "Bearer " + os.environ.get("${KEY_ENV.openai}", "")`]
      : target === "anthropic"
        ? [
            `"content-type": "application/json"`,
            `"x-api-key": os.environ["${KEY_ENV.anthropic}"]`,
            `"anthropic-version": "${ANTHROPIC_VERSION}"`,
          ]
        : [`"Content-Type": "application/json"`, `"x-goog-api-key": os.environ["${KEY_ENV.gemini}"]`];
  return [
    "import json",
    "import os",
    "import urllib.request",
    "",
    ...(target === "gemini" ? [`MODEL = "${MODEL_PLACEHOLDER}"`, ""] : []),
    // Eingerücktes JSON ist hier ein gültiges Python-Literal: der Rumpf enthält nur Texte, Zahlen, Listen und Objekte.
    `body = ${body}`,
    "",
    "request = urllib.request.Request(",
    `    ${url},`,
    `    data=json.dumps(body).encode("utf-8"),`,
    "    headers={",
    ...headers.map((h) => `        ${h},`),
    "    },",
    ")",
    "with urllib.request.urlopen(request) as response:",
    "    reply = json.load(response)",
    "",
    `print(reply${path})`,
    "",
  ].join("\n");
}

function javascript(target: ExportTarget, body: string): string {
  const path = REPLY_PATH[target].map((k) => (typeof k === "number" ? `[${k}]` : `.${k}`)).join("");
  const url =
    target === "openai"
      ? "`${process.env." + BASE_URL_ENV + ' ?? "' + OPENAI_BASE + '"}/chat/completions`'
      : target === "anthropic"
        ? `"${ANTHROPIC_URL}"`
        : "`" + GEMINI_BASE + "${MODEL}:generateContent`";
  const headers =
    target === "openai"
      ? [`"Content-Type": "application/json"`, "Authorization: `Bearer ${process.env." + KEY_ENV.openai + ' ?? ""}`']
      : target === "anthropic"
        ? [
            `"content-type": "application/json"`,
            `"x-api-key": process.env.${KEY_ENV.anthropic}`,
            `"anthropic-version": "${ANTHROPIC_VERSION}"`,
          ]
        : [`"Content-Type": "application/json"`, `"x-goog-api-key": process.env.${KEY_ENV.gemini}`];
  return [
    ...(target === "gemini" ? [`const MODEL = "${MODEL_PLACEHOLDER}";`, ""] : []),
    `const body = ${body};`,
    "",
    `const response = await fetch(${url}, {`,
    `  method: "POST",`,
    "  headers: {",
    ...headers.map((h) => `    ${h},`),
    "  },",
    "  body: JSON.stringify(body),",
    "});",
    "if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);",
    "const reply = await response.json();",
    `console.log(reply${path});`,
    "",
  ].join("\n");
}

/** Ein fertiger Aufruf der Schnittstelle: curl, Python (nur Standardbibliothek) oder JavaScript (fetch, ES-Modul). */
export function exportCode(target: ExportTarget, code: ExportCode, input: PromptExportInput): string {
  const indent = code === "python" ? 4 : 2;
  const body = JSON.stringify(requestBody(target, input), null, indent);
  if (code === "curl") return curl(target, body);
  return code === "python" ? python(target, body) : javascript(target, body);
}

/**
 * Die Datei `.prompt.md`: YAML-Kopf mit Titel, Schreibweise der Variablen, der Liste der Variablen und (falls gewählt)
 * der Systemnachricht, darunter der Prompt. Texte im Kopf stehen als JSON-Zeichenkette, die YAML wörtlich liest.
 * Wie jede heruntergeladene Datei ist sie als KI-erzeugt gekennzeichnet (shared/lib/ai-marker.ts), hier im Kopf,
 * weil ein Kommentar vor dem Kopf ihn für die meisten Leser unbrauchbar machte.
 */
export function exportPromptFile(input: PromptExportInput): string {
  const { system, user, variables } = messagesOf(input);
  const head = [
    "---",
    `title: ${JSON.stringify(input.title)}`,
    "template: mustache",
    variables.length === 0 ? "variables: []" : "variables:",
    ...variables.flatMap((v) => [`  - name: ${v.name}`, `    description: ${JSON.stringify(v.label)}`]),
    ...(system ? [`system: ${JSON.stringify(system)}`] : []),
    "ai_generated: true",
    'generator: "PromptPrinter (Finn)"',
    "---",
  ];
  return `${head.join("\n")}\n\n${user}\n`;
}

/** Dateiname aus dem Titel: "Brief an den Vermieter" wird `brief-an-den-vermieter.prompt.md`. */
export function promptFileName(title: string): string {
  const base = slug(title, "-").slice(0, 60).replace(/-+$/, "");
  return `${base || "prompt"}.prompt.md`;
}
