import { checkPrompt, type PromptRisk, type PromptRiskKind } from "@/shared/lib/prompt-check";

/**
 * Ob ein gespeicherter Prompt per Link geteilt ist (/geteilt/<token>, Migration 0057), so wie der Browser es bei
 * `GET /api/prompts/<id>/share` erfährt. Ein geteilter Prompt steht in seiner aktuellen Fassung sofort unter dem Link;
 * wer ihm einen neuen Text gibt (bearbeiten, eine alte Fassung wiederherstellen, im Chat als neue Version speichern),
 * prüft vorher auf Schlüssel und persönliche Angaben wie vor dem Teilen.
 *
 * "loading" und "error" heissen: unbekannt. Unbekannt zählt beim Schreiben wie geteilt, denn ein Lesefehler oder eine
 * langsame Antwort darf die Rückfrage nicht abschalten. Die Leiste zum Teilen zeigt "error" als eigenen Stand mit
 * einem Knopf zum Neuladen, nie als privat.
 */
export type ShareStatus =
  | { status: "loading" }
  | { status: "shared"; token: string }
  | { status: "private" }
  | { status: "error" };

/**
 * Liest den Stand. Privat ist ein Prompt nur, wenn die Antwort das ausdrücklich sagt (`token: null`); jeder Fehler
 * (Netz, Status, unerwartete Antwort) wird "error".
 */
export async function fetchShareStatus(promptId: string): Promise<ShareStatus> {
  try {
    const res = await fetch(`/api/prompts/${promptId}/share`);
    if (!res.ok) return { status: "error" };
    const body = (await res.json()) as { token?: unknown } | null;
    if (body?.token === null) return { status: "private" };
    return typeof body?.token === "string" && body.token ? { status: "shared", token: body.token } : { status: "error" };
  } catch {
    return { status: "error" };
  }
}

/** Nur ein sicher privater Prompt bekommt einen neuen Text ohne Prüfung. */
export function mayBePublic(share: ShareStatus): boolean {
  return share.status !== "private";
}

// Was vor dem Veröffentlichen nachfragt. Die übrigen Funde der Prompt-Prüfung (Befehle, Dateien, untergeschobene
// Anweisungen, Links) betreffen die KI, die den Prompt bekommt, nicht die Leser des Links.
const PUBLIC_RISKS = new Set<PromptRiskKind>(["secret", "personal"]);

/** Schlüssel und persönliche Angaben im Text: danach fragt Teilen, bevor der Text öffentlich wird. */
export function publicRisks(text: string): PromptRisk[] {
  return checkPrompt(text).filter((r) => PUBLIC_RISKS.has(r.kind));
}

/** Wonach vor dem Schreiben eines neuen Texts gefragt wird: nichts bei einem sicher privaten Prompt. */
export function risksBeforeWriting(share: ShareStatus, text: string): PromptRisk[] {
  return mayBePublic(share) ? publicRisks(text) : [];
}

/** Die Funde in einer Zeile, je Art mit den gekürzten Fundstellen ("Schlüssel (sk-a…89); …"). */
export function riskSummary(risks: PromptRisk[], labels: Record<PromptRiskKind, string>): string {
  return risks.map((r) => `${labels[r.kind]} (${r.samples.join(", ")})`).join("; ");
}
