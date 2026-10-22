import * as z from "@/shared/lib/zod";
import { truncate } from "@/shared/lib/chat-limits";

// Das Projekt-Gedächtnis ("AI Project Brain"): was PromptPrinter über ein
// Projekt weiss, nachdem es dessen Dateien und/oder GitHub-Repo einmal
// analysiert hat. Ab dann trägt jeder Chat dieses Projekts das Wissen
// automatisch mit — der Nutzer erklärt sein Projekt nie wieder. Bei einem
// Softwareprojekt ist das der Stack, bei einem allgemeinen (Lebenslauf,
// Vereinsstatuten, Notizen) Zielgruppe, Ton und die Eckdaten.
//
// Dieses Modul ist bewusst in shared/: die Fakten werden an drei Stellen
// gebraucht, die sich gegenseitig nicht kennen dürfen — der Server erzeugt
// sie (server/brain/), der Chat-Kontext formatiert sie
// (features/projects/lib/project-context.ts) und die Kontext-Rail zeigt sie
// an (features/projects/components/project-brain.tsx). Nichts hier fasst ein
// Geheimnis an oder spricht mit einem Provider, deshalb gehört es nicht nach
// server/.

/** Lebenszyklus einer Analyse. `idle` heisst „noch nie gelaufen". */
export const PROJECT_BRAIN_STATUSES = ["idle", "analyzing", "ready", "failed"] as const;
export type ProjectBrainStatus = (typeof PROJECT_BRAIN_STATUSES)[number];

/**
 * Ein einzelnes Textfeld der Analyse.
 *
 * Leerstring statt `null` für „nicht erkannt": das Modell antwortet in einem
 * festen JSON-Objekt, und ein fehlendes Feld von einem weggelassenen Feld zu
 * unterscheiden bringt hier nichts — beides heisst „steht nicht in den
 * Quellen". `formatBrainForPrompt` und die UI lassen leere Felder einfach weg.
 * 400 Zeichen sind grosszügig für eine Zeile wie „Next.js 15 (App Router)" und
 * decken zugleich, dass ein Modell mal einen ganzen Satz liefert.
 */
const factField = z.string().trim().max(400).default("");

/**
 * Was die Analyse über ein Projekt herausfindet.
 *
 * Die Kernfelder sind exakt die, die eine KI sonst bei jedem neuen Prompt neu erklärt bekommen
 * müsste: für ein Softwareprojekt Sprache bis Coding-Style, für ein allgemeines `audience`
 * (wen es erreichen soll), `tone` (wie es klingen soll) und `keyFacts` (die Eckdaten, die in
 * jedem Prompt stimmen müssen). Welche Felder die Analyse füllt, hängt von der Art des Projekts
 * ab (`ProjectKind`), die übrigen bleiben leer. `stack`, `keyFacts` und `conventions` sind
 * die Listen, die sich nicht sinnvoll in eine Zeile pressen lassen.
 * `confidence` ist die ehrliche Selbsteinschätzung des Modells: bei nur einem
 * README ist „low" die richtige Antwort, und die UI sagt das dann auch.
 */
export const projectBrainFactsSchema = z.object({
  summary: z.string().trim().max(600).default(""),
  audience: factField,
  tone: factField,
  language: factField,
  framework: factField,
  architecture: factField,
  database: factField,
  designSystem: factField,
  codingStyle: factField,
  conventions: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  stack: z.array(z.string().trim().min(1).max(80)).max(16).default([]),
  keyFacts: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  confidence: z.enum(["low", "medium", "high"]).default("low"),
});

export type ProjectBrainFacts = z.infer<typeof projectBrainFactsSchema>;

/** Leeres Brain, für „noch nie analysiert" und als Parse-Fallback. */
export const EMPTY_BRAIN_FACTS: ProjectBrainFacts = {
  summary: "",
  audience: "",
  tone: "",
  language: "",
  framework: "",
  architecture: "",
  database: "",
  designSystem: "",
  codingStyle: "",
  conventions: [],
  stack: [],
  keyFacts: [],
  confidence: "low",
};

/**
 * Reihenfolge und Beschriftung der Einzelfelder, für UI und Prompt-Block
 * gemeinsam. Eine Liste statt zweier, damit die Rail und der injizierte Block
 * nicht auseinanderlaufen können — ein neues Feld taucht sonst an genau einer
 * der beiden Stellen auf und niemandem fällt die andere auf.
 */
export const BRAIN_FIELDS = [
  { key: "audience", label: "Zielgruppe" },
  { key: "tone", label: "Ton" },
  { key: "framework", label: "Framework" },
  { key: "language", label: "Sprache" },
  { key: "architecture", label: "Architektur" },
  { key: "database", label: "Datenbank" },
  { key: "designSystem", label: "Design-System" },
  { key: "codingStyle", label: "Coding-Style" },
] as const satisfies readonly { key: keyof ProjectBrainFacts; label: string }[];

/** Woher ein Stück Analyse-Wissen kam. Wird mitgespeichert und angezeigt. */
export type BrainSource =
  | { kind: "file"; name: string }
  | { kind: "image"; name: string }
  | { kind: "repo"; name: string; ref: string | null };

export type ProjectBrain = {
  status: ProjectBrainStatus;
  facts: ProjectBrainFacts;
  repoUrl: string | null;
  sources: BrainSource[];
  /** Fingerabdruck der Quellen zum Analysezeitpunkt, siehe sourceDigest(). */
  sourceDigest: string | null;
  model: string | null;
  /** Stabiler Code, nie roher Provider-Text (Security-Audit M-1). */
  errorCode: string | null;
  analyzedAt: string | null;
  updatedAt: string;
};

/**
 * Wie viele Zeichen der Brain-Block im Systemprompt höchstens belegen darf.
 *
 * Der Block reist bei JEDEM Zug eines Projekt-Chats mit, ist also reine
 * Pro-Zug-Kosten — dieselbe Rechnung wie bei den Budgets in
 * project-context.ts. 2500 reicht für alle sieben Felder plus Listen in
 * normaler Länge; das ist rund ein Fünftel dessen, was der rohe Datei-Block
 * vorher allein verbraucht hat, und genau das ist der Punkt: ein einmal
 * destilliertes Brain ist billiger als die Quellen, aus denen es stammt.
 */
export const BRAIN_PROMPT_BUDGET = 2500;

/**
 * Der Block, den jeder Projekt-Chat im Systemprompt mitbekommt.
 *
 * Bewusst als knappe Faktenliste und nicht als Fliesstext: das Modell soll
 * die Werte übernehmen, nicht über sie diskutieren. Gibt "" zurück, wenn
 * nichts erkannt wurde — dann steht im Systemprompt lieber gar nichts als
 * eine leere Überschrift, die so klingt, als wüsste PromptPrinter etwas.
 */
export function formatBrainForPrompt(facts: ProjectBrainFacts): string {
  const lines: string[] = [];

  if (facts.summary) lines.push(facts.summary);

  for (const { key, label } of BRAIN_FIELDS) {
    const value = facts[key];
    if (typeof value === "string" && value) lines.push(`- ${label}: ${value}`);
  }

  if (facts.keyFacts.length > 0) {
    lines.push(`- Eckdaten:\n${facts.keyFacts.map((f) => `  - ${f}`).join("\n")}`);
  }
  if (facts.stack.length > 0) lines.push(`- Stack: ${facts.stack.join(", ")}`);
  if (facts.conventions.length > 0) {
    lines.push(`- Konventionen:\n${facts.conventions.map((c) => `  - ${c}`).join("\n")}`);
  }

  if (lines.length === 0) return "";

  // Die Unsicherheit wandert mit in den Prompt. Ohne sie behandelt das Modell
  // eine Vermutung aus einem einzigen README genauso verbindlich wie ein aus
  // package.json + Lockfile + Migrationen belegtes Ergebnis.
  const confidence =
    facts.confidence === "high"
      ? "belegt"
      : facts.confidence === "medium"
        ? "grösstenteils belegt"
        : "unsicher, aus wenigen Quellen abgeleitet";

  // Bewusst rein beschreibend, ohne Imperativ ("nutze das", "frag nicht
  // nach"). Der Systemprompt erklärt genau einen Satz weiter oben, dass alles
  // in PROJECT CONTEXT ausser den Instructions Referenzmaterial ist und keine
  // Anweisung — ein Block, der sich selbst zur Anweisung erklärt, würde genau
  // die Grenze verwischen, die die Prompt-Injection-Abwehr trägt. Was Finn
  // mit diesen Fakten tun soll (sie als gegeben nehmen, den Stack nicht noch
  // einmal erfragen), steht deshalb in CHAT_SYSTEM_PROMPT, wo Anweisungen
  // hingehören.
  return truncate(
    `Project Brain (automatisch aus den Projektdateien/dem Repo abgeleitet, Sicherheit: ${confidence}):\n${lines.join("\n")}`,
    BRAIN_PROMPT_BUDGET
  );
}

/** Hat die Analyse überhaupt etwas Verwertbares ergeben? */
export function hasBrainContent(facts: ProjectBrainFacts): boolean {
  return formatBrainForPrompt(facts).length > 0;
}

/**
 * Fingerabdruck der Analysequellen.
 *
 * Beantwortet genau eine Frage: „Sind die Quellen heute noch dieselben wie
 * beim letzten Lauf?" Deshalb ist es ausdrücklich KEIN kryptografischer Hash
 * — hier gibt es keinen Angreifer, der eine Kollision gewinnen würde, er
 * würde damit nur sein eigenes Projekt-Gedächtnis veralten lassen. Dafür ist
 * FNV-1a abhängigkeitsfrei und läuft im Server-Component-Render genauso wie
 * im Test, ohne node:crypto oder Web-Crypto-Verfügbarkeit vorauszusetzen.
 *
 * Die Eingabe wird sortiert, damit eine geänderte Upload-Reihenfolge nicht
 * als inhaltliche Änderung durchgeht.
 */
export function sourceDigest(parts: string[]): string {
  const input = [...parts].sort().join("\u0000");
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // FNV-Prime 16777619, per Shift-Summe statt `* 16777619`, damit das
    // Produkt nicht durch Number's 53-Bit-Mantisse rutscht.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Ab wann ein hängengebliebenes `analyzing` als abgebrochen gilt.
 *
 * Die Analyse läuft synchron in der Route (kein Job-System im Projekt), also
 * kann ein abgerissener Request den Status stehen lassen — der Prozess, der
 * ihn hätte aufräumen sollen, ist genau der, der weg ist. Statt dafür einen
 * Cron zu bauen, den es sonst nirgends gibt, entscheidet die Leseseite:
 * älter als das hier, und die UI bietet wieder „Analysieren" an, statt einen
 * Spinner zu zeigen, hinter dem nichts mehr läuft. Grosszügig über der
 * maxDuration der Route (300 s), damit ein echter langsamer Lauf nicht
 * fälschlich als tot gilt.
 */
export const BRAIN_ANALYZING_TIMEOUT_MS = 10 * 60 * 1000;

/** Läuft gerade wirklich eine Analyse, oder ist der Status nur liegengeblieben? */
export function isAnalysisRunning(brain: ProjectBrain, now: number = Date.now()): boolean {
  if (brain.status !== "analyzing") return false;
  return now - new Date(brain.updatedAt).getTime() < BRAIN_ANALYZING_TIMEOUT_MS;
}

/**
 * Haben sich die Quellen seit der Analyse geändert?
 *
 * Nur für ein fertiges Brain sinnvoll: ohne Analyse gibt es nichts, was
 * veralten könnte, und ein fehlgeschlagener Lauf ist nicht „veraltet",
 * sondern fehlgeschlagen.
 */
export function isBrainStale(brain: ProjectBrain, currentDigest: string): boolean {
  return brain.status === "ready" && brain.sourceDigest !== null && brain.sourceDigest !== currentDigest;
}
