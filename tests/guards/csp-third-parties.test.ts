import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { thirdPartiesFor, type ThirdParties } from "@/server/security/csp";

// Bindet die Pfadlisten in src/server/security/csp.ts (thirdPartiesFor) an den
// Quelltext, den sie beschreiben.
//
// ─── Warum es diesen Guard gibt ────────────────────────────────────────────
// Die CSP gibt Cloudflare Turnstile und Lemon Squeezy nur noch den Routen frei,
// die sie einbinden. Das ist eine handgepflegte Liste, und sie scheitert auf
// die leiseste Art: bindet jemand das Captcha oder den Checkout auf einer
// weiteren Seite ein und vergisst die Liste, lädt das Skript dort nicht, und
// der Browser meldet es nur in der Konsole. Der Checkout wäre tot, ohne dass
// ein Test oder der Build es merkt. Dieser Guard folgt deshalb den Importen von
// jeder page.tsx aus und prüft, dass die Liste genau die Seiten nennt, die das
// Modul tatsächlich erreichen.
//
// Beide Richtungen: eine Seite, die ein Modul erreicht und in der Liste fehlt
// (kaputt), und ein Pfad in der Liste, den keine Seite mehr erreicht (toter
// Eintrag, der einen Drittanbieter ohne Grund freigibt).

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

const FILES = sourceFiles(SRC);

function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  else return null; // Paket, kein eigener Code
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;

const GRAPH = new Map<string, string[]>(
  FILES.map((file) => {
    const text = readFileSync(file, "utf8");
    const deps = [...text.matchAll(IMPORT_RE)]
      .map((m) => resolveImport(file, m[1]))
      .filter((d): d is string => d !== null);
    return [file, deps];
  })
);

function reaches(entry: string, targets: Set<string>): boolean {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (targets.has(file)) return true;
    stack.push(...(GRAPH.get(file) ?? []));
  }
  return false;
}

/** `src/app/(marketing)/pricing/page.tsx` -> `/pricing` (Routengruppen fallen weg). */
function routeOf(file: string): string {
  const rel = relative(join(SRC, "app"), dirname(file)).replace(/\\/g, "/");
  const segments = rel.split("/").filter((s) => s && !/^\(.*\)$/.test(s));
  return `/${segments.join("/")}`;
}

function entriesReaching(modules: string[]): { pages: string[]; layouts: string[] } {
  const targets = new Set(modules.map((m) => join(SRC, m)));
  for (const t of targets) expect(existsSync(t), `${t} fehlt, Guard veraltet`).toBe(true);
  const hit = (name: string) =>
    FILES.filter((f) => f.startsWith(join(SRC, "app")) && f.endsWith(name) && reaches(f, targets));
  return { pages: hit("page.tsx").map(routeOf), layouts: hit("layout.tsx").map(routeOf) };
}

const CASES: { party: keyof ThirdParties; label: string; modules: string[] }[] = [
  {
    party: "turnstile",
    label: "Cloudflare Turnstile",
    modules: ["features/auth/components/turnstile-widget.tsx"],
  },
  {
    party: "lemonSqueezy",
    label: "Lemon Squeezy",
    modules: ["shared/ui/lemon-checkout-button.tsx", "shared/lib/use-lemon-squeezy.ts"],
  },
];

describe.each(CASES)("CSP-Freigabe: $label", ({ party, modules }) => {
  const { pages, layouts } = entriesReaching(modules);

  it("wird von mindestens einer Seite eingebunden (sonst ist der Guard blind)", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it("wird von keinem Layout eingebunden, denn das gälte für alle Seiten darunter", () => {
    expect(layouts, `Layout bindet ${party} ein, die Freigabe pro Pfad greift dafür nicht`).toEqual([]);
  });

  it("ist für jede Seite freigegeben, die es einbindet", () => {
    const missing = pages.filter((route) => !thirdPartiesFor(route)[party]);
    expect(
      missing,
      `Diese Seiten binden ${party} ein, thirdPartiesFor() gibt es dort aber nicht frei. ` +
        `Das Skript würde im Browser an der CSP scheitern:\n  ${missing.join("\n  ")}`
    ).toEqual([]);
  });

  it("gibt keine Seite frei, die es nicht mehr einbindet", () => {
    // Die Pfade, für die thirdPartiesFor() freigibt, bestimmt allein die Liste
    // in csp.ts: gefragt wird mit den Routen aller Seiten der App.
    const allRoutes = FILES.filter((f) => f.startsWith(join(SRC, "app")) && f.endsWith("page.tsx")).map(routeOf);
    const granted = allRoutes.filter((route) => thirdPartiesFor(route)[party]);
    const stale = granted.filter((route) => !pages.includes(route));
    expect(
      stale,
      `Freigegeben, aber von der Seite nicht eingebunden (Eintrag in csp.ts entfernen):\n  ${stale.join("\n  ")}`
    ).toEqual([]);
  });
});
