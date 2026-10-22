// Was für ein Projekt es ist: ein allgemeines (Bewerbungen, ein Verein, ein Brief, ein Plan) oder
// ein Softwareprojekt. Davon hängt ab, welche Felder die Rail unter "Struktur" zeigt, ob das
// Gedächtnis ein GitHub-Repository anbietet und wonach die Analyse sucht (Audit 2026-10-18, #154).
//
// Gespeichert in `projects.type` (Check-Constraint seit 0008: 'software' | 'general'). Neue Projekte
// sind 'general' (`api/projects/route.ts`), das Umschalten ist ein Häkchen in der Rail. Alt-Projekte
// aus der Zeit vor der Neuausrichtung tragen 'software' und behalten damit ihre Felder.

export const PROJECT_KINDS = ["general", "software"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

/** Unbekanntes oder fehlendes `type` ist ein allgemeines Projekt: die sichere Voreinstellung. */
export function projectKind(type: unknown): ProjectKind {
  return type === "software" ? "software" : "general";
}

/** Felder für jedes Projekt: wen es erreichen soll, in welchem Ton, was dahintersteht. */
export const GENERAL_FIELDS = ["audience", "tone", "background"] as const;

/** Felder, die nur ein Softwareprojekt braucht. */
export const SOFTWARE_FIELDS = ["frontend", "backend", "language", "database"] as const;

export type StructureField =
  | (typeof GENERAL_FIELDS)[number]
  | (typeof SOFTWARE_FIELDS)[number]
  | "notes";

/**
 * Die Felder unter "Struktur", in der Reihenfolge der Anzeige. Das Schlüsselwort ist zugleich der
 * Name im gespeicherten `projects.context`.
 *
 * Ein Feld der anderen Art, das schon Inhalt trägt, bleibt sichtbar: wer ein allgemeines Projekt
 * mit "Frontend: Vue" angelegt hat oder ein Softwareprojekt mit einer Zielgruppe, soll es nicht
 * beim Umschalten verlieren, auch wenn das Feld im Chat weiter gilt.
 */
export function structureFields(
  kind: ProjectKind,
  context: Readonly<Record<string, string>>
): StructureField[] {
  const own = kind === "software" ? SOFTWARE_FIELDS : GENERAL_FIELDS;
  const other = kind === "software" ? GENERAL_FIELDS : SOFTWARE_FIELDS;
  const carried = other.filter((key) => (context[key] ?? "").trim().length > 0);
  return [...own, ...carried, "notes"];
}
