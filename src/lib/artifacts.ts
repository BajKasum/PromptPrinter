// Canonical catalog of the artifacts that /api/generate produces and stores in
// `generations.outputs` (jsonb). Single source of truth for labels + categories,
// shared by the project detail tabs, the Generierungen log and the Bibliothek.

export type ArtifactCategory =
  | "doc"
  | "prompt"
  | "frontend"
  | "backend"
  | "database"
  | "marketing";

export type ArtifactMeta = {
  key: string;
  label: string;
  category: ArtifactCategory;
};

// Order matches the project detail tabs (after the synthesized "Übersicht").
export const ARTIFACT_META: readonly ArtifactMeta[] = [
  { key: "brief", label: "Produkt-Brief", category: "doc" },
  { key: "prd", label: "PRD", category: "doc" },
  { key: "master", label: "Master-Prompt", category: "prompt" },
  { key: "frontend", label: "Frontend-Prompt", category: "frontend" },
  { key: "backend", label: "Backend-Prompt", category: "backend" },
  { key: "schema", label: "Datenbank-Schema", category: "database" },
  { key: "security", label: "Sicherheits-Checkliste", category: "doc" },
  { key: "marketing", label: "Marketing-Texte", category: "marketing" },
  { key: "seo", label: "SEO-Plan", category: "marketing" },
  { key: "deployment", label: "Deployment-Anleitung", category: "doc" },
];

export const ARTIFACT_KEYS: string[] = ARTIFACT_META.map((a) => a.key);

export const ARTIFACT_LABELS: Record<string, string> = Object.fromEntries(
  ARTIFACT_META.map((a) => [a.key, a.label])
);

/** Count the non-empty artifacts stored in a generation's `outputs` bundle. */
export function countArtifacts(
  outputs: Record<string, unknown> | null | undefined
): number {
  if (!outputs) return 0;
  return ARTIFACT_KEYS.reduce((n, key) => {
    const v = outputs[key];
    return n + (typeof v === "string" && v.trim().length > 0 ? 1 : 0);
  }, 0);
}
