import "server-only";

// GitHub-Import für das Projekt-Gedächtnis.
//
// ─── Warum hier kein SSRF-Risiko entsteht ──────────────────────────────────
// Der Nutzer gibt eine Repo-URL an, und der Server holt daraufhin Daten. Das
// ist exakt die Form, in der die App schon einmal eine echte SSRF-Lücke hatte
// (Kritik-Pass S-1, BYOK-Custom-Provider: `z.string().url()`, und der Server
// fetchte, was da stand). Deshalb ist der Ansatz hier ein anderer:
//
//   Die eingegebene URL wird NIE gefetcht. Aus ihr werden nur `owner` und
//   `repo` extrahiert, beide gegen GitHubs eigenes Namensalphabet validiert,
//   und danach werden ausschliesslich URLs aufgerufen, die dieses Modul aus
//   zwei fest verdrahteten Hosts selbst zusammensetzt.
//
// Damit gibt es keinen Eingabewert, der das Ziel des Requests bestimmen
// könnte — kein `169.254.169.254`, kein `localhost`, kein Redirect-Trick.
// assertPublicHttpsUrl() (url-safety.ts) ist hier folgerichtig NICHT nötig:
// die Funktion existiert für den Fall, dass ein Host aus Nutzereingabe
// stammt, und genau das ist hier konstruktiv ausgeschlossen.
//
// ─── Warum zwei Hosts ──────────────────────────────────────────────────────
// api.github.com ist unauthentifiziert auf 60 Requests/Stunde PRO IP
// gedeckelt — auf einer geteilten Server-IP wäre das nach ein paar Analysen
// aufgebraucht. Deshalb laufen nur die zwei Requests darüber, die es müssen
// (Metadaten + Dateibaum), und die eigentlichen Dateiinhalte kommen von
// raw.githubusercontent.com, das nicht gegen dieses Kontingent zählt. Aus
// „14 Requests pro Analyse" werden so 2. Mit gesetztem GITHUB_TOKEN sind es
// 5000/h, dann ist das ohnehin kein Thema mehr.

const API_HOST = "https://api.github.com";
const RAW_HOST = "https://raw.githubusercontent.com";

/**
 * GitHubs eigenes Namensalphabet.
 *
 * Benutzer- und Organisationsnamen dürfen bei GitHub ausschliesslich
 * Buchstaben, Ziffern und Bindestriche enthalten — insbesondere KEINE Punkte.
 * Das ist hier nicht nur Kosmetik, sondern die Prüfung, an der die Kurzform
 * `owner/repo` von einem fremden Host wie `evil.com/owner/repo` unterschieden
 * wird: Letzteres scheitert am Punkt im Owner-Segment.
 *
 * Repo-Namen dürfen zusätzlich Punkt und Unterstrich führen.
 */
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const REPO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export type GithubRepoRef = {
  owner: string;
  repo: string;
  /** Kanonisch neu zusammengesetzt, nie die Roheingabe. */
  url: string;
};

/**
 * Warum ein Import fehlschlug — als stabiler Code, nie als Provider-Text
 * (Security-Audit M-1). Die UI übersetzt ihn selbst.
 */
export type GithubErrorCode =
  | "repo_invalid_url"
  | "repo_not_found"
  | "repo_rate_limited"
  | "repo_unavailable"
  | "repo_empty";

export class GithubImportError extends Error {
  constructor(readonly code: GithubErrorCode, message?: string) {
    super(message ?? code);
    this.name = "GithubImportError";
  }
}

/**
 * Zieht owner/repo aus allem, was ein Mensch als „mein Repo" hinschreibt.
 *
 * Akzeptiert die Web-URL (auch mit /tree/main/... dahinter), die .git-Form,
 * die SSH-Form und die blosse `owner/repo`-Kurzform. Gibt `null` zurück,
 * sobald irgendetwas nicht passt — es gibt bewusst keinen „na gut, versuchen
 * wir's"-Pfad, denn das Ergebnis dieser Funktion bestimmt, welche URL der
 * Server gleich aufruft.
 */
export function parseGithubRepoUrl(raw: string): GithubRepoRef | null {
  const input = raw.trim();
  if (!input || input.length > 300) return null;

  // Schema + Host abschneiden, aber NUR wenn der Host wirklich github.com
  // ist. Bleibt danach ein Schema stehen, war es ein anderer Host
  // (`https://evil.com/owner/repo`) — dann wird abgelehnt statt geraten.
  const ssh = input.match(/^git@github\.com:(.+)$/i);
  let path = ssh ? ssh[1] : input.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "");
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return null;

  // Query und Fragment abschneiden, bevor gesplittet wird: GitHubs eigene UI
  // hängt regelmässig `?tab=readme-ov-file` oder `#readme` an, und wer die
  // Adresszeile kopiert, bringt das mit. Für owner/repo trägt es nichts bei.
  path = path.split("#")[0].split("?")[0];
  path = path.replace(/^\/+/, "").replace(/\.git$/i, "");

  const segments = path.split("/").filter((s) => s.length > 0);
  if (segments.length < 2) return null;

  // Alles hinter owner/repo (z. B. /tree/main/src) wird verworfen, nicht
  // interpretiert: analysiert wird immer das ganze Repo auf seinem
  // Default-Branch.
  const [owner, repo] = segments;
  if (!OWNER_PATTERN.test(owner) || !REPO_PATTERN.test(repo)) return null;

  return { owner, repo, url: `https://github.com/${owner}/${repo}` };
}

export type RepoFile = { path: string; content: string };

export type RepoSnapshot = {
  ref: GithubRepoRef;
  /** Analysierter Stand (Default-Branch). */
  sha: string;
  defaultBranch: string;
  description: string | null;
  /** GitHubs eigene Spracherkennung, ein guter erster Anhaltspunkt. */
  primaryLanguage: string | null;
  topics: string[];
  /** Verdichteter Verzeichnisbaum, siehe summarizeTree(). */
  treeSummary: string;
  /** Anzahl Dateien im Repo (vor jeder Kürzung), für die Verdichtung. */
  fileCount: number;
  files: RepoFile[];
};

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
/** Und höchstens so viel Text je Datei mitnehmen. */
const MAX_REPO_FILE_CHARS = 20000;

/** Verzeichnisse, deren Inhalt über die Architektur nichts aussagt. */
const IGNORED_TREE_PREFIXES = [
  "node_modules/",
  ".git/",
  ".next/",
  "dist/",
  "build/",
  "vendor/",
  "target/",
  "coverage/",
  ".venv/",
  "__pycache__/",
  ".turbo/",
];

const REQUEST_TIMEOUT_MS = 15000;

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "PromptPrinter-ProjectBrain",
    "x-github-api-version": "2022-11-28",
  };
  // Optional: hebt das Kontingent von 60/h auf 5000/h. Ohne Token
  // funktioniert alles, nur eben seltener (siehe Kopfkommentar).
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function githubJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: githubHeaders(),
      signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // Ein Redirect könnte das Ziel verlassen; hier gibt es keinen legitimen
      // Grund dafür, also gar nicht erst folgen (dieselbe Linie wie llm.ts'
      // customComplete seit S-1).
      redirect: "error",
    });
  } catch {
    throw new GithubImportError("repo_unavailable");
  }

  if (res.status === 404) throw new GithubImportError("repo_not_found");
  if (res.status === 403 || res.status === 429) {
    // GitHub setzt bei aufgebrauchtem Kontingent x-ratelimit-remaining: 0;
    // ein 403 ohne das ist eher „privates Repo, kein Zugriff", und das ist
    // aus Nutzersicht dasselbe wie „gibt es nicht".
    throw new GithubImportError(
      res.headers.get("x-ratelimit-remaining") === "0" ? "repo_rate_limited" : "repo_not_found"
    );
  }
  if (!res.ok) throw new GithubImportError("repo_unavailable");

  try {
    return (await res.json()) as T;
  } catch {
    throw new GithubImportError("repo_unavailable");
  }
}

type RepoMeta = {
  default_branch?: string;
  description?: string | null;
  language?: string | null;
  topics?: string[];
};

type TreeResponse = {
  tree?: { path?: string; type?: string; size?: number }[];
  truncated?: boolean;
};

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
 * Holt den analysierbaren Stand eines öffentlichen Repos.
 *
 * Private Repos sind bewusst nicht unterstützt: dafür bräuchte es OAuth mit
 * Repo-Scope, also einen dauerhaften Zugriff auf fremden Quellcode auf dem
 * Server. Das ist eine eigene Vertrauens- und Datenschutzfrage, keine
 * Erweiterung dieses Features — wer ein privates Repo analysieren lassen
 * will, lädt die relevanten Dateien hoch, dafür gibt es die Dateiliste.
 */
export async function fetchRepoSnapshot(
  ref: GithubRepoRef,
  signal?: AbortSignal
): Promise<RepoSnapshot> {
  const slug = `${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;

  const meta = await githubJson<RepoMeta>(`${API_HOST}/repos/${slug}`, signal);
  const defaultBranch = typeof meta.default_branch === "string" ? meta.default_branch : "main";

  const tree = await githubJson<TreeResponse>(
    `${API_HOST}/repos/${slug}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
    signal
  );

  const paths = (tree.tree ?? [])
    .filter((entry) => entry.type === "blob" && typeof entry.path === "string")
    .map((entry) => entry.path as string)
    .filter((path) => !IGNORED_TREE_PREFIXES.some((prefix) => path.startsWith(prefix)));

  if (paths.length === 0) throw new GithubImportError("repo_empty");

  const wanted = paths
    .map((path) => ({ path, rank: signalRank(path) }))
    .filter((entry) => entry.rank !== -1)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_REPO_FILES);

  // Parallel, denn keine dieser Dateien hängt von einer anderen ab, und sie
  // liegen alle auf dem CDN. Seriell wären es bei 14 Dateien 14 addierte
  // Latenzen auf dem kritischen Pfad einer Analyse, auf die der Nutzer
  // sichtbar wartet.
  const files = (
    await Promise.all(wanted.map((entry) => fetchRawFile(ref, defaultBranch, entry.path, signal)))
  ).filter((file): file is RepoFile => file !== null);

  return {
    ref,
    sha: defaultBranch,
    defaultBranch,
    description: typeof meta.description === "string" ? meta.description : null,
    primaryLanguage: typeof meta.language === "string" ? meta.language : null,
    topics: Array.isArray(meta.topics)
      ? meta.topics.filter((t) => typeof t === "string").slice(0, 12)
      : [],
    treeSummary: summarizeTree(paths),
    fileCount: paths.length,
    files,
  };
}

/**
 * Eine einzelne Datei vom Raw-CDN. Ein Fehlschlag ist hier kein Grund, die
 * ganze Analyse abzubrechen — eine fehlende Datei von vierzehn heisst nur,
 * dass ein Signal weniger da ist.
 */
async function fetchRawFile(
  ref: GithubRepoRef,
  branch: string,
  path: string,
  signal?: AbortSignal
): Promise<RepoFile | null> {
  // Der Pfad kommt aus GitHubs eigener Tree-Antwort, nicht aus Nutzereingabe.
  // Trotzdem segmentweise kodiert: ein Dateiname mit `?` oder `#` würde die
  // URL sonst an der falschen Stelle beenden.
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `${RAW_HOST}/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/${encodeURIComponent(branch)}/${encodedPath}`;

  try {
    const res = await fetch(url, {
      signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: "error",
      headers: { "user-agent": "PromptPrinter-ProjectBrain" },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return {
      path,
      content: text.length > MAX_REPO_FILE_CHARS ? `${text.slice(0, MAX_REPO_FILE_CHARS)}…` : text,
    };
  } catch {
    return null;
  }
}
