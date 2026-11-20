import { describe, expect, it, vi } from "vitest";
import {
  ANTHROPIC_VERSION,
  canSplitSystem,
  exportCode,
  exportJson,
  exportPromptFile,
  promptFileName,
  requestBody,
  splitFirstParagraph,
  toTemplate,
  variableName,
  type ExportTarget,
  type PromptExportInput,
} from "@/shared/lib/prompt-export";

const BRIEF = "Du schreibst kurze, höfliche Briefe.\n\nSchreib an [Name des Vermieters] wegen [Thema]. Gruss, [dein Name]";
const TARGETS: ExportTarget[] = ["openai", "anthropic", "gemini"];

// Ein Prompt mit allem, was beim Einbetten in Shell, Python und JavaScript schiefgehen könnte.
const NASTY = [
  `Sag "Hallo" und 'Tschüss', C:\\Pfad\\neu, $HOME, \${x}, \`ls\`, '''drei''', """auch""".`,
  "JSON",
  "Ende mit Backslash \\",
].join("\n");

describe("toTemplate", () => {
  it("macht offene Platzhalter zu {{name}}, setzt Werte ein und lässt markierte Klammern stehen", () => {
    const fill = { values: { thema: "  Heizung " }, skipped: new Set(["dein name"]) };
    const { text, variables } = toTemplate(BRIEF, fill);
    expect(text).toBe(
      "Du schreibst kurze, höfliche Briefe.\n\nSchreib an {{name_des_vermieters}} wegen Heizung. Gruss, [dein Name]"
    );
    expect(variables).toEqual([{ name: "name_des_vermieters", label: "Name des Vermieters" }]);
  });

  it("ohne Eingaben wird jeder Platzhalter zur Variable, gleiche Platzhalter teilen sich eine", () => {
    const { text, variables } = toTemplate("[Ort] und [ort] und [Datum]");
    expect(text).toBe("{{ort}} und {{ort}} und {{datum}}");
    expect(variables.map((v) => v.name)).toEqual(["ort", "datum"]);
  });

  it("vergibt bei gleichen Namen eine Nummer", () => {
    const { text, variables } = toTemplate("[Name!] [Name?]");
    expect(text).toBe("{{name}} {{name_2}}");
    expect(variables).toEqual([
      { name: "name", label: "Name!" },
      { name: "name_2", label: "Name?" },
    ]);
  });

  it("schreibt Umlaute aus und behält andere Schriften", () => {
    expect(variableName("Größe der Tür")).toBe("groesse_der_tuer");
    expect(variableName("Café crème")).toBe("cafe_creme");
    expect(variableName("名前")).toBe("名前");
    expect(variableName("!!!")).toBe("wert");
  });

  it("lässt einen Prompt ohne Platzhalter, wie er ist", () => {
    expect(toTemplate("Schreib ein Gedicht.")).toEqual({ text: "Schreib ein Gedicht.", variables: [] });
  });
});

describe("splitFirstParagraph", () => {
  it("trennt am ersten leeren Absatz, auch mit Leerraum in der Leerzeile", () => {
    expect(splitFirstParagraph("Rolle.\n \t\nAufgabe.\n\nMehr.")).toEqual({ system: "Rolle.", user: "Aufgabe.\n\nMehr." });
  });

  it("lässt einen einzigen Absatz ganz in user", () => {
    expect(splitFirstParagraph("Nur eine Zeile.\nUnd noch eine.")).toEqual({ system: null, user: "Nur eine Zeile.\nUnd noch eine." });
    expect(canSplitSystem("Nur eine Zeile.")).toBe(false);
    expect(canSplitSystem(BRIEF)).toBe(true);
  });
});

describe("requestBody", () => {
  const base: PromptExportInput = { prompt: BRIEF, title: "Brief" };
  const user = "Du schreibst kurze, höfliche Briefe.\n\nSchreib an {{name_des_vermieters}} wegen {{thema}}. Gruss, {{dein_name}}";
  const split = { ...base, systemFromFirstParagraph: true };
  const tail = "Schreib an {{name_des_vermieters}} wegen {{thema}}. Gruss, {{dein_name}}";

  it("OpenAI-kompatibel: alles in einer user-Nachricht, auf Wunsch der erste Absatz als system", () => {
    expect(requestBody("openai", base)).toEqual({ model: "MODEL_NAME", messages: [{ role: "user", content: user }] });
    expect(requestBody("openai", split)).toEqual({
      model: "MODEL_NAME",
      messages: [
        { role: "system", content: "Du schreibst kurze, höfliche Briefe." },
        { role: "user", content: tail },
      ],
    });
  });

  it("Anthropic: max_tokens ist Pflicht, system steht oben, nicht als Nachricht", () => {
    expect(requestBody("anthropic", base)).toEqual({
      model: "MODEL_NAME",
      max_tokens: 4096,
      messages: [{ role: "user", content: user }],
    });
    expect(requestBody("anthropic", split)).toEqual({
      model: "MODEL_NAME",
      max_tokens: 4096,
      system: "Du schreibst kurze, höfliche Briefe.",
      messages: [{ role: "user", content: tail }],
    });
  });

  it("Gemini: contents mit parts, systemInstruction nur auf Wunsch, das Modell steht in der Adresse", () => {
    expect(requestBody("gemini", base)).toEqual({ contents: [{ role: "user", parts: [{ text: user }] }] });
    expect(requestBody("gemini", split)).toEqual({
      systemInstruction: { parts: [{ text: "Du schreibst kurze, höfliche Briefe." }] },
      contents: [{ role: "user", parts: [{ text: tail }] }],
    });
  });

  it("trennt nichts ab, wenn der Prompt nur einen Absatz hat", () => {
    const one = { prompt: "Schreib ein Gedicht.", title: "G", systemFromFirstParagraph: true };
    expect(requestBody("openai", one)).toEqual({ model: "MODEL_NAME", messages: [{ role: "user", content: "Schreib ein Gedicht." }] });
  });

  it("exportJson ist genau dieser Rumpf als JSON", () => {
    for (const target of TARGETS) expect(JSON.parse(exportJson(target, base))).toEqual(requestBody(target, base));
  });
});

// Die Antwort je Ziel, so wie die Anbieter sie dokumentieren; der Code muss den Text an dieser Stelle finden.
const REPLY: Record<ExportTarget, unknown> = {
  openai: { choices: [{ message: { content: "Antwort" } }] },
  anthropic: { content: [{ type: "text", text: "Antwort" }] },
  gemini: { candidates: [{ content: { parts: [{ text: "Antwort" }] } }] },
};

async function runJavaScript(code: string, target: ExportTarget, env: Record<string, string>) {
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => ({ ok: true, json: async () => REPLY[target] }));
  const log = vi.fn();
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (
    ...args: unknown[]
  ) => Promise<void>;
  await new AsyncFunction("fetch", "process", "console", code)(fetch, { env }, { log });
  const [url, init] = fetch.mock.calls[0];
  return { url, init, log };
}

describe("exportCode: JavaScript", () => {
  it.each(TARGETS)("%s: schickt genau den Rumpf an die richtige Adresse und gibt den Antworttext aus", async (target) => {
    const input = { prompt: BRIEF, title: "Brief", systemFromFirstParagraph: true };
    const { url, init, log } = await runJavaScript(exportCode(target, "javascript", input), target, {
      OPENAI_API_KEY: "k-openai",
      ANTHROPIC_API_KEY: "k-anthropic",
      GEMINI_API_KEY: "k-gemini",
    });
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(requestBody(target, input));
    const headers = init.headers as Record<string, string>;
    if (target === "openai") {
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      expect(headers.Authorization).toBe("Bearer k-openai");
    } else if (target === "anthropic") {
      expect(url).toBe("https://api.anthropic.com/v1/messages");
      expect(headers["x-api-key"]).toBe("k-anthropic");
      expect(headers["anthropic-version"]).toBe(ANTHROPIC_VERSION);
    } else {
      expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/MODEL_NAME:generateContent");
      expect(headers["x-goog-api-key"]).toBe("k-gemini");
    }
    expect(log).toHaveBeenCalledWith("Antwort");
  });

  it("OpenAI-kompatibel: die Adresse kommt aus OPENAI_BASE_URL (Ollama, LM Studio, OpenRouter …), ein Key ist kein Muss", async () => {
    const { url, init } = await runJavaScript(exportCode("openai", "javascript", { prompt: "Hi", title: "x" }), "openai", {
      OPENAI_BASE_URL: "http://localhost:11434/v1",
    });
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer ");
  });

  it("übersteht Anführungszeichen, Backslashes, $ und Backticks unverändert", async () => {
    const { init } = await runJavaScript(exportCode("openai", "javascript", { prompt: NASTY, title: "x" }), "openai", {});
    expect(JSON.parse(init.body as string).messages[0].content).toBe(NASTY);
  });
});

describe("exportCode: curl", () => {
  const bodyOf = (out: string) => JSON.parse(out.slice(out.indexOf("<<'JSON'\n") + 9, out.lastIndexOf("\nJSON\n")));

  it.each(TARGETS)("%s: Rumpf als Here-Document, Key nur aus der Umgebung", (target) => {
    const input = { prompt: BRIEF, title: "Brief" };
    const out = exportCode(target, "curl", input);
    expect(bodyOf(out)).toEqual(requestBody(target, input));
    expect(out).toContain("--data-binary @- <<'JSON'");
    expect(out).toContain({ openai: "$OPENAI_API_KEY", anthropic: "$ANTHROPIC_API_KEY", gemini: "$GEMINI_API_KEY" }[target]);
    if (target === "openai") expect(out).toContain('curl "${OPENAI_BASE_URL:-https://api.openai.com/v1}/chat/completions"');
    if (target === "anthropic") expect(out).toContain(`-H "anthropic-version: ${ANTHROPIC_VERSION}"`);
    if (target === "gemini") expect(out).toContain('"https://generativelanguage.googleapis.com/v1beta/models/MODEL_NAME:generateContent"');
  });

  it("nur die letzte Zeile beendet das Here-Document, auch wenn im Prompt eine Zeile JSON steht", () => {
    const out = exportCode("anthropic", "curl", { prompt: NASTY, title: "x" });
    expect(out.split("\n").filter((line) => line === "JSON")).toHaveLength(1);
    expect(bodyOf(out).messages[0].content).toBe(NASTY);
  });
});

describe("exportCode: Python", () => {
  const bodyOf = (out: string) => JSON.parse(out.slice(out.indexOf("body = ") + 7, out.indexOf("\n\nrequest = ")));

  it.each(TARGETS)("%s: nur Standardbibliothek, Rumpf als Literal, Key aus der Umgebung, Antwortpfad", (target) => {
    const input = { prompt: NASTY, title: "x", systemFromFirstParagraph: true };
    const out = exportCode(target, "python", input);
    expect(out.startsWith("import json\nimport os\nimport urllib.request\n")).toBe(true);
    expect(bodyOf(out)).toEqual(requestBody(target, input));
    expect(out).toContain(
      {
        openai: 'os.environ.get("OPENAI_API_KEY", "")',
        anthropic: 'os.environ["ANTHROPIC_API_KEY"]',
        gemini: 'os.environ["GEMINI_API_KEY"]',
      }[target]
    );
    expect(out).toContain(
      {
        openai: 'print(reply["choices"][0]["message"]["content"])',
        anthropic: 'print(reply["content"][0]["text"])',
        gemini: 'print(reply["candidates"][0]["content"]["parts"][0]["text"])',
      }[target]
    );
  });
});

describe("exportPromptFile", () => {
  it("schreibt einen YAML-Kopf mit Titel, Variablen und Kennzeichnung, darunter den Prompt", () => {
    const out = exportPromptFile({ prompt: BRIEF, title: 'Brief "Heizung"', fill: { values: { thema: "Heizung" }, skipped: new Set() } });
    expect(out).toBe(
      [
        "---",
        'title: "Brief \\"Heizung\\""',
        "template: mustache",
        "variables:",
        "  - name: name_des_vermieters",
        '    description: "Name des Vermieters"',
        "  - name: dein_name",
        '    description: "dein Name"',
        "ai_generated: true",
        'generator: "PromptPrinter (Finn)"',
        "---",
        "",
        "Du schreibst kurze, höfliche Briefe.",
        "",
        "Schreib an {{name_des_vermieters}} wegen Heizung. Gruss, {{dein_name}}",
        "",
      ].join("\n")
    );
  });

  it("nimmt die Systemnachricht in den Kopf, wenn sie gewählt ist, und kennt Prompts ohne Variablen", () => {
    const out = exportPromptFile({ prompt: "Rolle.\n\nAufgabe.", title: "T", systemFromFirstParagraph: true });
    expect(out).toContain("variables: []\n");
    expect(out).toContain('system: "Rolle."\n');
    expect(out.endsWith("---\n\nAufgabe.\n")).toBe(true);
  });
});

describe("promptFileName", () => {
  it("macht aus dem Titel einen Dateinamen", () => {
    expect(promptFileName("Brief an den Vermieter (Heizung)")).toBe("brief-an-den-vermieter-heizung.prompt.md");
    expect(promptFileName("Größe")).toBe("groesse.prompt.md");
    expect(promptFileName("???")).toBe("prompt.prompt.md");
    expect(promptFileName("a".repeat(100))).toBe(`${"a".repeat(60)}.prompt.md`);
  });
});
