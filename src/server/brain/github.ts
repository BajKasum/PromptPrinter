import "server-only";

import { optionalEnv } from "@/server/env-value";
import { logEvent, logWarning } from "@/shared/lib/observability";
import { selectSignalFiles, summarizeTree } from "@/server/brain/github-select";

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

// Die Auswahl der Dateien liegt in github-select.ts (Dateigröße), bleibt von hier aus erreichbar.
export { selectSignalFiles, summarizeTree };

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

/**
 * Verbindet den vom Aufrufer durchgereichten Abbruch (die Analyse-Route
 * gibt ihren eigenen request.signal weiter) MIT dem festen Timeout, statt
 * ihn zu ERSETZEN.
 *
 * M-11 (Audit 06.09.2026): `signal ?? AbortSignal.timeout(...)` sah aus wie
 * ein Rueckfall, war aber ein Ersatz — der einzige Produktionsaufrufer
 * reicht immer ein Signal durch, der `??`-Zweig griff also nie, und die
 * 15s existierten faktisch nicht. Haengt GitHub, lief die Analyse bis zur
 * maxDuration der Route (300s) statt nach 15 Sekunden abzubrechen. Dasselbe
 * Muster wie llm.ts' withProviderTimeout.
 */
export function withRequestTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "PromptPrinter-ProjectBrain",
    "x-github-api-version": "2022-11-28",
  };
  // Optional: hebt das Kontingent von 60/h auf 5000/h. Ohne Token
  // funktioniert alles, nur eben seltener (siehe Kopfkommentar).
  // optionalEnv: ein leer gesetztes Token oder ein Zeilenumbruch dahinter (beim
  // Einfügen in Vercel mitgenommen) machte aus jedem Import ein "repo_unavailable".
  const token = optionalEnv("GITHUB_TOKEN");
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Meldet, wie viel vom GitHub-Kontingent noch da ist (Betriebs-Audit M4,
 * 05.10.2026). Ohne diese Zeile liess sich nicht sehen, ob GITHUB_TOKEN in
 * Produktion wirklich greift: der Header steht nur in GitHubs Antwort, und die
 * Route reicht ihn nicht weiter. Mit Token steht hier `limit: 5000`, ohne
 * `limit: 60` (pro IP, auf einer geteilten Server-IP schnell aufgebraucht).
 *
 * Nie der Token selbst, nur ob einer gesetzt ist. Eine Antwort ohne diese Header
 * (die Raw-Dateien vom CDN) loggt nichts.
 */
function logQuota(res: Response): void {
  // Number(null) ist 0: erst auf das Vorhandensein pruefen, sonst meldete jede
  // Antwort ohne die Header "Limit 0".
  const rawLimit = res.headers.get("x-ratelimit-limit");
  const rawRemaining = res.headers.get("x-ratelimit-remaining");
  if (rawLimit === null || rawRemaining === null) return;
  const limit = Number(rawLimit);
  const remaining = Number(rawRemaining);
  if (!Number.isFinite(limit) || !Number.isFinite(remaining)) return;
  logEvent("brain.github_quota", {
    authenticated: Boolean(optionalEnv("GITHUB_TOKEN")),
    limit,
    remaining,
  });
}

async function githubJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: githubHeaders(),
      signal: withRequestTimeout(signal),
      // Ein Redirect könnte das Ziel verlassen; hier gibt es keinen legitimen
      // Grund dafür, also gar nicht erst folgen (dieselbe Linie wie llm.ts'
      // customComplete seit S-1).
      redirect: "error",
    });
  } catch {
    throw new GithubImportError("repo_unavailable");
  }

  logQuota(res);

  if (res.status === 404) throw new GithubImportError("repo_not_found");
  if (res.status === 403 || res.status === 429) {
    // GitHub setzt bei aufgebrauchtem Kontingent x-ratelimit-remaining: 0;
    // ein 403 ohne das ist eher „privates Repo, kein Zugriff", und das ist
    // aus Nutzersicht dasselbe wie „gibt es nicht".
    const exhausted = res.headers.get("x-ratelimit-remaining") === "0";
    // Fuer den Nutzer nur "in einer Stunde nochmal", fuer den Betreiber ein
    // Alarm: das Kontingent ist ein Betriebszustand, kein Nutzerfehler.
    if (exhausted) {
      logWarning("brain.github_rate_limited", { authenticated: Boolean(optionalEnv("GITHUB_TOKEN")) });
    }
    throw new GithubImportError(exhausted ? "repo_rate_limited" : "repo_not_found");
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
  // Die SHA des zurückgegebenen Baum-Objekts selbst — GitHub akzeptiert einen
  // Branch-Namen hier nur als Komfort, löst ihn aber intern auf den exakten
  // Tree-Stand auf. Ändert sich auch nur eine Datei, ändert sich diese SHA.
  sha?: string;
  tree?: { path?: string; type?: string; size?: number }[];
  truncated?: boolean;
};

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

  // Parallel, denn keine dieser Dateien hängt von einer anderen ab, und sie
  // liegen alle auf dem CDN. Seriell wären es bei 14 Dateien 14 addierte
  // Latenzen auf dem kritischen Pfad einer Analyse, auf die der Nutzer
  // sichtbar wartet.
  const files = (
    await Promise.all(
      selectSignalFiles(paths).map((path) => fetchRawFile(ref, defaultBranch, path, signal))
    )
  ).filter((file): file is RepoFile => file !== null);

  return {
    ref,
    // M-13 (Audit 06.09.2026): stand vorher auf defaultBranch, also z.B. dem
    // festen String "main" — fuer JEDES Repo, bei JEDEM Lauf unveraenderlich.
    // Migration 0037 schreibt der Spalte ausdruecklich den Zweck zu, ein
    // Gedaechtnis als veraltet zu erkennen, sobald sich das Repo aendert —
    // mit einem Branch-Namen statt einer echten Inhalts-SHA konnte das nie
    // eintreten. tree.sha ist die SHA des zurueckgegebenen Baum-Objekts
    // selbst (siehe TreeResponse oben), aendert sich also mit jeder Aenderung
    // am Dateibestand, und kostet keinen zusaetzlichen Request.
    sha: typeof tree.sha === "string" ? tree.sha : defaultBranch,
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
      signal: withRequestTimeout(signal),
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
