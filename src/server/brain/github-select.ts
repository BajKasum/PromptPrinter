import "server-only";

// Die reine Auswahl für den GitHub-Import (aus github.ts ausgelagert, Dateigröße, Betriebs-Audit
// Folgesitzung 2026-10-07): welche Dateien eines Repos geholt werden und wie der Baum verdichtet
// wird. Kein Netz, keine Umgebung, keine Datenbank: Pfade hinein, Pfade und Text heraus.

/**
 * Dateien, aus denen sich ein Stack tatsächlich ablesen lässt — in dieser
 * Reihenfolge, weil das Budget von oben nach unten vergeben wird.
 *
 * Zuerst die Manifeste (die sagen Sprache, Framework und Abhängigkeiten in
 * einer Datei), dann Build-/Tooling-Konfiguration (Konventionen), dann
 * Datenbank-Schemata, dann als Letztes die README (Prosa, am wenigsten
 * verlässlich, aber gut für den Zweck des Projekts).
 */
const SIGNAL_FILES = [
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "Cargo.toml",
  "composer.json",
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "pubspec.yaml",
  "Package.swift",
  "tsconfig.json",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "vite.config.ts",
  "nuxt.config.ts",
  "svelte.config.js",
  "astro.config.mjs",
  "angular.json",
  "tailwind.config.ts",
  "tailwind.config.js",
  "eslint.config.mjs",
  "eslint.config.js",
  ".eslintrc.json",
  "biome.json",
  "prisma/schema.prisma",
  "drizzle.config.ts",
  "supabase/config.toml",
  "docker-compose.yml",
  "Dockerfile",
  "README.md",
  "readme.md",
  "CONTRIBUTING.md",
  "CLAUDE.md",
  "AGENTS.md",
] as const;

/** Höchstens so viele Dateien holen — jede ist ein eigener Request. */
const MAX_REPO_FILES = 14;

/**
 * Verdichtet den Dateibaum zu etwas, das in einen Prompt passt.
 *
 * Ein Repo hat schnell tausende Pfade — die einzeln zu übertragen wäre teuer
 * und für die Frage „wie ist das Projekt aufgebaut?" auch gar nicht nötig.
 * Was zählt, ist die Form: welche Verzeichnisse es auf den ersten zwei Ebenen
 * gibt, wie viele Dateien darin liegen, und welche Endungen dominieren. Genau
 * daraus liest sich Architektur ab (`app/` + `components/` + `lib/` sagt mehr
 * als 900 Einzelpfade).
 */
export function summarizeTree(paths: string[], maxChars = 2000): string {
  const counts = new Map<string, number>();
  const extensions = new Map<string, number>();

  for (const path of paths) {
    const segments = path.split("/");
    const dir = segments.length === 1 ? "(root)" : segments.slice(0, 2).join("/");
    counts.set(dir, (counts.get(dir) ?? 0) + 1);

    const dot = segments[segments.length - 1].lastIndexOf(".");
    if (dot > 0) {
      const ext = segments[segments.length - 1].slice(dot).toLowerCase();
      extensions.set(ext, (extensions.get(ext) ?? 0) + 1);
    }
  }

  const dirs = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 40)
    .map(([dir, n]) => `${dir} (${n})`);

  const exts = [...extensions.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([ext, n]) => `${ext} ${n}`);

  const summary = `Verzeichnisse: ${dirs.join(", ")}\nDateitypen: ${exts.join(", ")}`;
  return summary.length > maxChars ? `${summary.slice(0, maxChars - 1)}…` : summary;
}

/** Ist dieser Pfad eine der Dateien, aus denen sich der Stack ablesen lässt? */
function signalRank(path: string): number {
  const index = SIGNAL_FILES.indexOf(path as (typeof SIGNAL_FILES)[number]);
  if (index !== -1) return index;
  // Auch ein Manifest in einem Workspace-Unterordner zählt (Monorepo), aber
  // schlechter als das im Wurzelverzeichnis.
  const base = path.split("/").pop() ?? "";
  const baseIndex = SIGNAL_FILES.indexOf(base as (typeof SIGNAL_FILES)[number]);
  return baseIndex === -1 ? -1 : baseIndex + SIGNAL_FILES.length;
}

/**
 * Wie viele Treffer desselben Dateinamens höchstens mitgenommen werden.
 *
 * Beim ersten echten Lauf gegen dieses Repo selbst gingen 5 der 14 Plätze an
 * `README.md`-Dateien tief unter `.claude/skills` — der Namensabgleich oben
 * zieht jeden Treffer, egal wie tief. Fünf Beschreibungen desselben UI-Kits
 * sagen über den Stack aber nichts, was die erste nicht schon gesagt hat, und
 * sie verdrängten Dateien, die etwas gesagt hätten. Zwei pro Name lassen den
 * Monorepo-Fall (ein package.json je Workspace) heil und schneiden die
 * Wiederholung ab.
 */
const MAX_PER_BASENAME = 2;

/**
 * Wählt die Dateien aus, die tatsächlich geholt werden.
 *
 * Sortiert nach Signalrang, bei Gleichstand nach Pfadtiefe: `package.json` im
 * Wurzelverzeichnis vor `apps/web/package.json`, denn das obere beschreibt
 * das Projekt, das untere einen Teil davon.
 */
export function selectSignalFiles(paths: string[], limit = MAX_REPO_FILES): string[] {
  const ranked = paths
    .map((path) => ({ path, rank: signalRank(path), depth: path.split("/").length }))
    .filter((entry) => entry.rank !== -1)
    .sort((a, b) => a.rank - b.rank || a.depth - b.depth || a.path.localeCompare(b.path));

  const perBasename = new Map<string, number>();
  const chosen: string[] = [];

  for (const entry of ranked) {
    if (chosen.length >= limit) break;
    const base = (entry.path.split("/").pop() ?? "").toLowerCase();
    const used = perBasename.get(base) ?? 0;
    if (used >= MAX_PER_BASENAME) continue;
    perBasename.set(base, used + 1);
    chosen.push(entry.path);
  }

  return chosen;
}
