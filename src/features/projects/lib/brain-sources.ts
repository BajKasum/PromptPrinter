import "server-only";

import { fileKind } from "@/features/projects/lib/project-files";
import { fetchRepoSnapshot, parseGithubRepoUrl, type RepoSnapshot } from "@/server/brain/github";
import type { BrainAnalysisInput } from "@/server/brain/analyze";
import { sourceDigest, type BrainSource } from "@/shared/lib/project-brain";
import type { createClient } from "@/server/supabase/server";

// Sammelt alles, woraus sich das Projekt-Gedächtnis ableiten lässt: die
// hochgeladenen Projektdateien und, falls hinterlegt, den aktuellen Stand des
// GitHub-Repos.
//
// WARUM DAS HIER LIEGT UND NICHT IN server/brain/: das Modul kennt die
// Projektdateien (features/projects) UND den GitHub-Import (server/brain).
// Die Schichtregel erlaubt features → server, nicht umgekehrt (siehe
// tests/guards/layer-boundaries.test.ts), also ist das der einzige Ort, an
// dem beides zusammenkommen darf. server/brain/analyze.ts bekommt deshalb
// fertige Daten übergeben und weiss von Supabase nichts.
//
// ─── Budgets ───────────────────────────────────────────────────────────────
// Diese sind bewusst um ein Vielfaches grosszügiger als die in
// project-context.ts. Das ist genau die Ökonomie des Features: die Analyse
// läuft EINMAL und darf dafür viel lesen; das Ergebnis ist danach ein
// 2500-Zeichen-Block, der bei jedem Chat-Zug mitreist. Vorher wanderten die
// Rohdateien selbst in jeden einzelnen Zug.
const TEXT_TOTAL_BUDGET = 60000;
const TEXT_PER_FILE_BUDGET = 12000;

/**
 * Wie viele Screenshots in eine Analyse gehen.
 *
 * Bilder sind der teuerste Teil einer Analyse (sie reisen als Base64 im
 * Request und werden vom Anbieter nach Pixelfläche abgerechnet), und der
 * Grenznutzen fällt schnell: der dritte Screenshot derselben App zeigt
 * dieselbe Design-Sprache wie der erste. Drei ist die Zahl, bei der noch
 * Übersicht, Detailseite und Formular hineinpassen.
 */
const MAX_ANALYSIS_IMAGES = 3;
/** Und dieses Gesamtvolumen darf der Request an Bilddaten nicht überschreiten. */
const MAX_ANALYSIS_IMAGE_BYTES = 6 * 1024 * 1024;

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export type CollectedSources = {
  /** Was an das Modell geht. */
  input: BrainAnalysisInput;
  /** Was gespeichert und in der Rail angezeigt wird. */
  sources: BrainSource[];
  /** Fingerabdruck derselben Quellen, für „hat sich seither etwas geändert?". */
  digest: string;
  /** Analysierter Repo-Stand (Branch), falls ein Repo dabei war. */
  repoRef: string | null;
  /** Kanonische Repo-URL, falls eine gültige angegeben war. */
  repoUrl: string | null;
};

/**
 * Der Fingerabdruck der aktuellen Quellenlage — ohne irgendetwas
 * herunterzuladen.
 *
 * Getrennt von collectBrainSources(), weil die Leseseite (Workspace-Layout,
 * bei JEDEM Seitenaufruf) nur wissen muss, ob sich etwas geändert hat. Dafür
 * einen kompletten Storage- und GitHub-Durchlauf zu starten wäre absurd.
 * Datei-ID und -Grösse reichen: storage_path ist unveränderlich, eine
 * geänderte Datei ist immer eine neue Zeile (siehe project-file-cache.ts).
 */
export function digestOfSources(
  files: { id: string; sizeBytes: number }[],
  repoUrl: string | null
): string {
  const parts = files.map((f) => `file:${f.id}:${f.sizeBytes}`);
  if (repoUrl) parts.push(`repo:${repoUrl}`);
  return sourceDigest(parts);
}

/**
 * Lädt Dateien und Repo und formt daraus die Analyse-Eingabe.
 *
 * Ein fehlgeschlagener Repo-Import wirft (GithubImportError) — er ist eine
 * ausdrückliche Nutzerangabe, und stillschweigend ohne das Repo weiterzurechnen
 * würde ein Ergebnis liefern, das jemand für „das Repo wurde analysiert" hält.
 * Eine einzelne nicht lesbare Datei wird dagegen übersprungen: sie war nicht
 * ausdrücklich Gegenstand der Anfrage.
 */
export async function collectBrainSources(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  options: { projectName: string; repoUrl: string | null; signal?: AbortSignal }
): Promise<CollectedSources> {
  // Explizites user_id neben RLS (CLAUDE.mds Defense-in-depth-Standard).
  const { data: rows } = await supabase
    .from("project_files")
    .select("id, name, storage_path, size_bytes")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const files = (rows as
    | { id: string; name: string; storage_path: string; size_bytes: number }[]
    | null) ?? [];

  const ref = options.repoUrl ? parseGithubRepoUrl(options.repoUrl) : null;

  // Repo und Dateien parallel: keins hängt vom anderen ab, und beide liegen
  // auf dem kritischen Pfad einer Analyse, auf die der Nutzer sichtbar wartet.
  const [snapshot, texts, images] = await Promise.all([
    ref ? fetchRepoSnapshot(ref, options.signal) : Promise.resolve(null),
    downloadTextFiles(supabase, files),
    downloadImageFiles(supabase, files),
  ]);

  const sources: BrainSource[] = [];
  const documents: BrainAnalysisInput["documents"] = [];

  // Repo zuerst: es ist die verlässlichste Quelle (echte Manifeste statt
  // dessen, was jemand für erwähnenswert hielt) und bekommt deshalb den
  // ersten Zugriff auf das Textbudget.
  if (snapshot) {
    sources.push({ kind: "repo", name: `${snapshot.ref.owner}/${snapshot.ref.repo}`, ref: snapshot.sha });
    documents.push(...repoDocuments(snapshot));
  }

  for (const file of texts) {
    sources.push({ kind: "file", name: file.name });
    documents.push({ label: file.name, text: file.text });
  }

  const usedImages = images.slice(0, MAX_ANALYSIS_IMAGES);
  for (const image of usedImages) {
    sources.push({ kind: "image", name: image.name });
  }
  // Die nicht analysierten Bilder bleiben trotzdem in `sources` NICHT
  // aufgeführt — sonst behauptet die Rail, ein Screenshot sei eingeflossen,
  // der es nicht ist. Sie liegen weiter im Projekt und sind über die
  // Dateiliste sichtbar.

  const budgeted = applyTextBudget(documents);

  return {
    input: {
      projectName: options.projectName,
      documents: budgeted,
      images: usedImages.map((i) => ({ name: i.name, mediaType: i.mediaType, base64: i.base64 })),
      repo: snapshot
        ? {
            slug: `${snapshot.ref.owner}/${snapshot.ref.repo}`,
            description: snapshot.description,
            primaryLanguage: snapshot.primaryLanguage,
            topics: snapshot.topics,
            treeSummary: snapshot.treeSummary,
            fileCount: snapshot.fileCount,
          }
        : null,
    },
    sources,
    digest: digestOfSources(
      files.map((f) => ({ id: f.id, sizeBytes: f.size_bytes })),
      ref?.url ?? null
    ),
    repoRef: snapshot?.sha ?? null,
    repoUrl: ref?.url ?? null,
  };
}

/** Die Repo-Dateien als Dokumente, mit dem Repo-Pfad als Label. */
function repoDocuments(snapshot: RepoSnapshot): BrainAnalysisInput["documents"] {
  return snapshot.files.map((file) => ({
    label: `${snapshot.ref.repo}/${file.path}`,
    text: file.content,
  }));
}

/**
 * Verteilt das gemeinsame Textbudget in Reihenfolge.
 *
 * Sequenziell und nicht anteilig, weil die Reihenfolge bereits die Priorität
 * ist (Repo-Manifeste vor hochgeladenen Notizen). Was nicht mehr passt, wird
 * weggelassen statt anteilig gekürzt — ein zu einem Viertel übertragenes
 * package.json ist schlechter als gar keins, weil das Modell den Rest dann
 * ergänzt statt es offenzulassen.
 */
function applyTextBudget(documents: BrainAnalysisInput["documents"]): BrainAnalysisInput["documents"] {
  const out: BrainAnalysisInput["documents"] = [];
  let remaining = TEXT_TOTAL_BUDGET;

  for (const doc of documents) {
    if (remaining <= 0) break;
    const cap = Math.min(TEXT_PER_FILE_BUDGET, remaining);
    const text = doc.text.length > cap ? `${doc.text.slice(0, cap - 1)}…` : doc.text;
    if (!text.trim()) continue;
    out.push({ label: doc.label, text });
    remaining -= text.length;
  }

  return out;
}

async function downloadTextFiles(
  supabase: SupabaseClient,
  files: { name: string; storage_path: string }[]
): Promise<{ name: string; text: string }[]> {
  const textFiles = files.filter((f) => fileKind(f.name) !== "image" && fileKind(f.name) !== null);

  const results = await Promise.all(
    textFiles.map(async (file) => {
      try {
        const { data: blob, error } = await supabase.storage
          .from("project-files")
          .download(file.storage_path);
        if (error || !blob) return null;
        return { name: file.name, text: (await blob.text()).trim() };
      } catch {
        return null;
      }
    })
  );

  return results.filter((r): r is { name: string; text: string } => r !== null && r.text.length > 0);
}

const IMAGE_MEDIA_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function mediaTypeOf(name: string): string {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return (dot === -1 ? undefined : IMAGE_MEDIA_TYPES[lower.slice(dot)]) ?? "image/png";
}

async function downloadImageFiles(
  supabase: SupabaseClient,
  files: { name: string; storage_path: string; size_bytes: number }[]
): Promise<{ name: string; mediaType: string; base64: string }[]> {
  const candidates = files.filter((f) => fileKind(f.name) === "image").slice(0, MAX_ANALYSIS_IMAGES);
  if (candidates.length === 0) return [];

  const results = await Promise.all(
    candidates.map(async (file) => {
      try {
        const { data: blob, error } = await supabase.storage
          .from("project-files")
          .download(file.storage_path);
        if (error || !blob) return null;
        const buffer = Buffer.from(await blob.arrayBuffer());
        return { name: file.name, mediaType: mediaTypeOf(file.name), base64: buffer.toString("base64"), bytes: buffer.byteLength };
      } catch {
        return null;
      }
    })
  );

  // Volumen erst nach dem Laden begrenzen: `size_bytes` ist ein vom Client
  // geschriebener Wert, die tatsächliche Bytezahl ist die verlässliche.
  const out: { name: string; mediaType: string; base64: string }[] = [];
  let remaining = MAX_ANALYSIS_IMAGE_BYTES;
  for (const result of results) {
    if (!result || result.bytes > remaining) continue;
    remaining -= result.bytes;
    out.push({ name: result.name, mediaType: result.mediaType, base64: result.base64 });
  }
  return out;
}
