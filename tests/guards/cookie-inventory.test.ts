import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIRST_PARTY_STORAGE } from "../../src/features/marketing/lib/cookie-inventory";

// Die Cookie-Richtlinie (/cookies) muss jedes Cookie und jeden
// localStorage-Schlüssel nennen, den die App selbst schreibt. Art. 45c FMG
// verlangt die Information, und eine Liste, die ein neues Cookie verschweigt,
// sieht genauso vollständig aus wie eine richtige. Deshalb ein Guard und kein
// Merkzettel (Rechts-Audit 28.09.2026).
//
// Geprüft wird, was sich aus dem Quelltext lesen lässt: `document.cookie =`
// mit einem festen Namen oder einer String-Konstante, und `localStorage`/
// `sessionStorage.setItem` mit festem Schlüssel. Die Supabase-Cookies setzt
// die Bibliothek selbst, für sie reicht es, dass ein `sb-`-Eintrag existiert.

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({ path, text: readFileSync(path, "utf8") }));

/** `export const NAME = "value"` aus dem ganzen Baum, um `${NAME}=` aufzulösen. */
const constants = new Map<string, string>();
for (const { text } of files) {
  for (const m of text.matchAll(/const\s+([A-Z][A-Z0-9_]*)\s*=\s*"([^"]+)"/g)) {
    constants.set(m[1], m[2]);
  }
}

function writtenCookieNames(): string[] {
  const names: string[] = [];
  for (const { path, text } of files) {
    for (const m of text.matchAll(/document\.cookie\s*=\s*[`"']([^`"'=]*)=/g)) {
      const raw = m[1].trim();
      const ref = /^\$\{([A-Z][A-Z0-9_]*)\}$/.exec(raw);
      const name = ref ? constants.get(ref[1]) : raw;
      if (!name) throw new Error(`Cookie-Name in ${path} nicht auflösbar: ${raw}`);
      names.push(name);
    }
  }
  return names;
}

function writtenStorageKeys(): string[] {
  const keys: string[] = [];
  for (const { text } of files) {
    for (const m of text.matchAll(/(?:local|session)Storage\.setItem\(\s*["'`]([^"'`]+)["'`]/g)) {
      keys.push(m[1]);
    }
  }
  return keys;
}

const documented = new Set(FIRST_PARTY_STORAGE.map((e) => e.name));

describe("Cookie-Richtlinie", () => {
  it("findet die Cookies, die die App heute schreibt (der Guard sieht überhaupt etwas)", () => {
    expect(writtenCookieNames()).toEqual(expect.arrayContaining(["pp-sidebar", "pp-sidebar-width"]));
  });

  it("nennt jedes Cookie, das der Code selbst setzt", () => {
    const missing = writtenCookieNames().filter((name) => !documented.has(name));
    expect(
      missing,
      `Diese Cookies fehlen in src/features/marketing/lib/cookie-inventory.ts ` +
        `und damit auf /cookies: ${missing.join(", ")}`
    ).toEqual([]);
  });

  it("nennt jeden localStorage-/sessionStorage-Schlüssel mit festem Namen", () => {
    const missing = writtenStorageKeys().filter((key) => !documented.has(key));
    expect(missing, `Nicht dokumentierte Browser-Speicher-Schlüssel: ${missing.join(", ")}`).toEqual([]);
  });

  // next-themes schreibt unter "theme", solange niemand einen eigenen
  // storageKey setzt. Wer das ändert, muss den Eintrag mitziehen.
  it("hält den Theme-Schlüssel beim dokumentierten Standard", () => {
    const appLayout = readFileSync(join(SRC, "app", "(app)", "layout.tsx"), "utf8");
    expect(appLayout).not.toMatch(/storageKey\s*=/);
    expect(documented.has("theme")).toBe(true);
  });

  it("nennt die Anmelde-Cookies von Supabase", () => {
    expect([...documented].some((name) => name.startsWith("sb-"))).toBe(true);
  });
});
