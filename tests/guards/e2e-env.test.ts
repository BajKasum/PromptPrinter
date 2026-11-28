import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parse, walk } from "./parse-source";
import {
  E2E_ORIGIN,
  E2E_PROD_ORIGIN,
  NOT_IN_TEMPLATE,
  prodServerEnv,
  serverEnv,
  templateVariables,
} from "../../e2e/support/env";
import { RESEND_KEY } from "../../e2e/support/fakes.cjs";

// Die Umgebung der Browser-Tests (e2e/support/env.ts) ist vollständig und ausdrücklich: Next lädt zusätzlich
// `.env.local`, und nur ein gesetzter Wert, auch ein leerer, schlägt die Datei. Jede Variable aus .env.example steht
// deshalb in der Umgebung, leer bis auf die wenigen, die hier genannt sind. Eine neue Variable ist damit von selbst
// aus; eine, die der Code liest und die niemand in die Vorlage schreibt, meldet der letzte Test.

const ROOT = process.cwd();
const template = readFileSync(join(ROOT, ".env.example"), "utf8");
const declared = templateVariables(template);
const LOCAL = "http://127.0.0.1:54321";

beforeAll(() => {
  vi.stubEnv("E2E_SUPABASE_URL", LOCAL);
  vi.stubEnv("E2E_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("E2E_SUPABASE_SERVICE_ROLE_KEY", "service");
});
afterAll(() => vi.unstubAllEnvs());

/** Die Variablen aus Vorlage und Zusatzliste, die einen Wert tragen. */
function setValues(env: Record<string, string>) {
  return Object.fromEntries([...declared, ...NOT_IN_TEMPLATE].filter((name) => env[name] !== "").map((name) => [name, env[name]]));
}

describe("templateVariables", () => {
  it("nennt gesetzte und auskommentierte Variablen, jede einmal, und keine Wörter aus dem Text", () => {
    const sample = [
      "# Ein Satz mit LLM_BASE_URL unten, und GITHUB_TOKEN erwähnt.",
      "A_KEY=wert",
      "# B_KEY=beispiel",
      "#   C_KEY=http://host.docker.internal:11434/v1",
      "# C_KEY=http://localhost:11434/v1",
      "D_KEY=",
      "#   - E_KEY= ist eine Liste, keine Zuweisung",
      "klein=nein",
    ].join("\n");
    expect(templateVariables(sample)).toEqual(["A_KEY", "B_KEY", "C_KEY", "D_KEY"]);
  });

  it("findet die Variablen der echten Vorlage, auch die nur auskommentierten", () => {
    expect(declared.length).toBeGreaterThan(30);
    expect(declared).toEqual(
      expect.arrayContaining(["ZAI_API_KEY", "LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY", "SELF_HOSTED", "RESEND_API_KEY"])
    );
  });
});

describe("Umgebung des Dev-Servers der Tests", () => {
  it("setzt jede Variable der Vorlage, leer bis auf die genannten", () => {
    const env = serverEnv();
    for (const name of [...declared, ...NOT_IN_TEMPLATE]) expect(Object.hasOwn(env, name), name).toBe(true);
    expect(setValues(env)).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: LOCAL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      NEXT_PUBLIC_APP_URL: E2E_ORIGIN,
      TRUSTED_PROXY_HOPS: "1",
      API_KEY_ENCRYPTION_SECRET: expect.stringMatching(/^.{32,}$/),
      // Der Wert, den nur der Stellvertreter von Resend annimmt (support/fakes.cjs).
      RESEND_API_KEY: RESEND_KEY,
    });
  });

  it("lädt die Stellvertreter in den Server und lässt vorhandene Node-Optionen stehen", () => {
    vi.stubEnv("NODE_OPTIONS", "--max-old-space-size=4096");
    const options = serverEnv().NODE_OPTIONS;
    expect(options).toMatch(/^--max-old-space-size=4096 --require .*e2e\/support\/outbound-fakes\.cjs"?$/);
    expect(serverEnv().E2E_OUTBOUND_LOG).toMatch(/pp-e2e-outbound-.+\.jsonl$/);
  });
});

describe("Umgebung des Produktions-Servers der Tests", () => {
  it("setzt jede Variable der Vorlage, leer bis auf die genannten, ohne Stellvertreter und Versand", () => {
    const env = prodServerEnv();
    expect(setValues(env)).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: LOCAL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      NEXT_PUBLIC_APP_URL: E2E_PROD_ORIGIN,
      TRUSTED_PROXY_HOPS: "1",
      API_KEY_ENCRYPTION_SECRET: expect.stringMatching(/^.{32,}$/),
      UPSTASH_REDIS_REST_URL: "https://placeholder.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "placeholder-token-for-e2e-only",
      ALLOW_INSECURE_APP_URL: "1",
    });
    expect(env.NODE_OPTIONS).toBeUndefined();
  });
});

/** Die Funktionen, die eine Variable beim Namen aus der Umgebung lesen. */
const ENV_HELPERS = new Set(["optionalEnv", "msFromEnv"]);
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;

/**
 * Die Namen, die eine Datei aus der Umgebung liest: `process.env.X`, `process.env["X"]`, `env.X` an einer übergebenen
 * Umgebung (etwa `isSelfHosted(env)`) und die Helfer oben. Der Parser sieht keine Kommentare und Zeichenketten.
 */
function envReads(file: string, text?: string): string[] {
  const names: string[] = [];
  const isEnvObject = (node: ts.Expression) =>
    (ts.isIdentifier(node) && node.text === "env") ||
    (ts.isPropertyAccessExpression(node) && node.getText() === "process.env");
  walk(parse(file, text), (node) => {
    if (ts.isPropertyAccessExpression(node) && isEnvObject(node.expression)) names.push(node.name.text);
    if (ts.isElementAccessExpression(node) && isEnvObject(node.expression) && ts.isStringLiteralLike(node.argumentExpression)) {
      names.push(node.argumentExpression.text);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ENV_HELPERS.has(node.expression.text)) {
      const [first] = node.arguments;
      if (first && ts.isStringLiteralLike(first)) names.push(first.text);
    }
  });
  return names.filter((name) => ENV_NAME.test(name));
}

describe("Variablen, die der Code liest", () => {
  /** Von Node, Next oder dem Testlauf selbst gesetzt: kein Wert aus einer .env.local ändert damit einen Test. */
  const PLATFORM = ["NODE_ENV", "NEXT_RUNTIME", "PP_E2E", "WATCHPACK_POLLING"];

  function sources(dir: string): string[] {
    return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return sources(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
    });
  }
  const read = new Map<string, string>();
  for (const file of [...sources("src"), "next.config.ts"]) {
    for (const name of envReads(file)) read.set(name, file);
  }

  it("findet jede Schreibweise eines Lesezugriffs, nichts aus Kommentaren und Texten", () => {
    const sample = [
      "// process.env.NUR_KOMMENTAR",
      'const text = "process.env.NUR_TEXT";',
      "const a = process.env.DIREKT ?? process.env['GEKLAMMERT'];",
      'const b = optionalEnv("UEBER_HELFER") ?? msFromEnv("UEBER_ZEIT", 5);',
      "const c = (env: Record<string, string>) => env.UEBERGEBEN;",
      "const d = other.NICHT_UMGEBUNG;",
    ].join("\n");
    expect(envReads("src/x.ts", sample)).toEqual(["DIREKT", "GEKLAMMERT", "UEBER_HELFER", "UEBER_ZEIT", "UEBERGEBEN"]);
  });

  it("findet die Lesezugriffe des Codes", () => {
    expect([...read.keys()]).toEqual(expect.arrayContaining(["ZAI_API_KEY", "LLM_BASE_URL", "FREE_TRIAL_DAILY_CALLS"]));
  });

  it("jede steht in .env.example, in NOT_IN_TEMPLATE oder gehört zur Plattform", () => {
    const known = new Set([...declared, ...NOT_IN_TEMPLATE, ...PLATFORM]);
    const unknown = [...read].filter(([name]) => !known.has(name)).map(([name, file]) => `${name} (${file})`);
    expect(
      unknown,
      "Neue Umgebungsvariable: in .env.example eintragen, dann ist sie in den Browser-Tests von selbst leer:\n  " +
        unknown.join("\n  ")
    ).toEqual([]);
  });

  it("NOT_IN_TEMPLATE nennt nur, was in der Vorlage fehlt und gelesen wird", () => {
    for (const name of NOT_IN_TEMPLATE) {
      expect(declared, `${name} steht jetzt in .env.example: aus NOT_IN_TEMPLATE nehmen`).not.toContain(name);
      expect([...read.keys()], name).toContain(name);
    }
  });
});
