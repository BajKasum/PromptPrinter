/**
 * Meldet das Ergebnis des täglichen Audits (.github/workflows/audit.yml) als
 * GitHub-Issue: eines, das einmal angelegt, bei jedem weiteren Fehlschlag
 * ergänzt und geschlossen wird, sobald alles wieder sauber ist.
 *
 * ─── Warum es das gibt ──────────────────────────────────────────────────────
 * Ein Advisory erscheint, wann es will: am 23.09. und 01.10.2026 färbte es den
 * nächsten, unbeteiligten Push rot, weil `npm audit` nur bei Pushes läuft. Der
 * tägliche Lauf auf main findet es VOR dem nächsten Push. Ein geplanter Lauf
 * färbt aber keinen Commit, und die Mail, die GitHub bei einem gescheiterten
 * Lauf schickt, kommt nur, wenn Benachrichtigungen für Actions an sind. Ein
 * Issue ist das, was Kasum sicher sieht und was offen bleibt, bis jemand
 * entscheidet.
 *
 * ─── Was als "Problem" zählt ────────────────────────────────────────────────
 * 1. der Audit ist gescheitert (offener Fund, abgelaufene Ausnahme, Registry
 *    nicht erreichbar, oder der Lauf kam gar nicht bis zum Audit), oder
 * 2. eine Ausnahme in `ACCEPTED` (scripts/audit-gate.mjs) läuft in höchstens
 *    7 Tagen ab. Der Audit ist dann noch grün, aber in einer Woche färbt er
 *    jeden Branch rot. Die Ausnahme für `braces` (bis 2026-11-04) wäre sonst
 *    der nächste Überraschungs-Ausfall, nur diesmal mit Ansage.
 *
 * ─── Eine Entscheidungsstelle ───────────────────────────────────────────────
 * `plan()` ist rein und sagt nur, WAS zu tun ist (anlegen, ergänzen, schließen,
 * nichts). `run()` führt es über eine eingereichte `gh`-Funktion aus, damit der
 * ganze Ablauf ohne Netz testbar ist. Nur `main()` kennt die Umgebung und das
 * echte `gh`. Das Issue wird am Titel erkannt, nicht allein am Label: ein von
 * Hand mit demselben Label angelegtes Issue wird nie angefasst.
 *
 * Usage (CI): AUDIT_STATUS=failure|success|skipped AUDIT_LOG=audit.log \
 *             AUDIT_SIMULATED=true|false GH_TOKEN=… node scripts/audit-issue.mjs
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { ACCEPTED } from "./audit-gate.mjs";

export const TITLE = "Audit: Abhängigkeiten brauchen eine Entscheidung";
export const LABEL = "audit";
export const WARN_DAYS = 7;
/** Mehr passt in kein lesbares Issue, und das Wichtige steht in den ersten Zeilen. */
export const MAX_LOG_CHARS = 3000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** @param {Date | string} today */
function dayOf(today) {
  return (today instanceof Date ? today : new Date(today)).toISOString().slice(0, 10);
}

/**
 * Ausnahmen, die in höchstens `days` Tagen ablaufen. Eine heute ablaufende gilt
 * noch (der Audit lässt sie am Ablauftag durch), eine gestern abgelaufene steht
 * hier nicht mehr: sie lässt den Audit selbst scheitern.
 *
 * @param {{ id: string, pkg: string, until: string }[]} accepted
 * @param {Date | string} today
 * @param {number} [days]
 */
export function expiringSoon(accepted, today, days = WARN_DAYS) {
  const now = Date.parse(dayOf(today));
  return accepted
    .map((entry) => ({ ...entry, daysLeft: Math.round((Date.parse(entry.until) - now) / DAY_MS) }))
    .filter((entry) => entry.daysLeft >= 0 && entry.daysLeft <= days);
}

/**
 * Was mit dem Issue zu tun ist.
 *
 * @param {{ failed: boolean, expiring: unknown[], openIssue: number | null }} state
 * @returns {"create" | "comment" | "close" | "none"}
 */
export function plan({ failed, expiring, openIssue }) {
  const problem = failed || expiring.length > 0;
  if (problem) return openIssue === null ? "create" : "comment";
  return openIssue === null ? "none" : "close";
}

/** Das Protokoll, gekürzt und so entschärft, dass es den Codeblock nicht verlässt. */
export function excerpt(log) {
  const text = (log ?? "").trim();
  if (!text) return "(kein Protokoll: der Lauf kam nicht bis zum Audit, siehe Lauf)";
  const clipped = text.length > MAX_LOG_CHARS ? `${text.slice(0, MAX_LOG_CHARS)}\n… (gekürzt)` : text;
  // Advisory-Titel sind fremder Text. Drei Backticks darin würden den Block
  // beenden und den Rest als Markdown rendern.
  return clipped.replaceAll("```", "ʼʼʼ");
}

/**
 * @param {{
 *   failed: boolean,
 *   expiring: { id: string, pkg: string, until: string, daysLeft: number }[],
 *   log: string,
 *   runUrl: string,
 *   today: string,
 *   simulated: boolean,
 * }} input
 */
export function bodyFor({ failed, expiring, log, runUrl, today, simulated }) {
  const lines = [];
  if (simulated) {
    lines.push(
      "> **Simulation.** Dieser Lauf wurde von Hand mit `simulate_failure` gestartet, um den Meldeweg zu prüfen. Es gibt keinen echten Fund.",
      ""
    );
  }
  lines.push(`### Stand ${today}`, "");
  if (failed) {
    lines.push(
      "Der tägliche Audit ist **gescheitert**. Ausgabe von `npm run audit:gate`:",
      "",
      "```text",
      excerpt(log),
      "```",
      ""
    );
  }
  if (expiring.length > 0) {
    lines.push("Eine befristete Ausnahme in `scripts/audit-gate.mjs` läuft bald ab:", "");
    for (const e of expiring) {
      lines.push(`- \`${e.id}\` (${e.pkg}): bis **${e.until}**, noch ${e.daysLeft} Tag(e)`);
    }
    lines.push(
      "",
      "Danach scheitert der Audit auf jedem Branch. Entscheiden: gepatchte Version anheben und den Eintrag löschen, Major-Sprung, oder verlängern mit neuer Begründung und neuem Datum.",
      ""
    );
  }
  lines.push(`[Lauf ansehen](${runUrl})`);
  return lines.join("\n");
}

/**
 * Führt den Plan aus. `gh(args, stdin?)` liefert die Standardausgabe oder wirft.
 *
 * @param {{
 *   status: string,
 *   log: string,
 *   simulated: boolean,
 *   runUrl: string,
 *   today?: Date | string,
 *   accepted?: Parameters<typeof expiringSoon>[0],
 *   gh: (args: string[], stdin?: string) => string,
 * }} input
 */
export function run({ status, log, simulated, runUrl, today = new Date(), accepted = ACCEPTED, gh }) {
  // Alles außer einem ausdrücklichen "success" zählt als Fehlschlag, auch
  // "skipped" (npm ci scheiterte, der Audit lief nie): ein Lauf, der nichts
  // geprüft hat, darf nie grün aussehen.
  const failed = status !== "success";
  const expiring = expiringSoon(accepted, today);
  const day = dayOf(today);

  const listed = JSON.parse(
    gh(["issue", "list", "--label", LABEL, "--state", "open", "--json", "number,title", "--limit", "50"]) || "[]"
  );
  const open = listed.find((issue) => issue.title === TITLE);
  const openIssue = open ? open.number : null;

  const action = plan({ failed, expiring, openIssue });

  if (action === "create") {
    // --force: legt das Label an oder aktualisiert es, ohne bei "gibt es schon"
    // zu scheitern.
    gh(["label", "create", LABEL, "--force", "--color", "B60205", "--description", "Meldung des täglichen Abhängigkeits-Audits"]);
    gh(
      ["issue", "create", "--title", TITLE, "--label", LABEL, "--body-file", "-"],
      bodyFor({ failed, expiring, log, runUrl, today: day, simulated })
    );
  } else if (action === "comment") {
    gh(
      ["issue", "comment", String(openIssue), "--body-file", "-"],
      bodyFor({ failed, expiring, log, runUrl, today: day, simulated })
    );
  } else if (action === "close") {
    gh([
      "issue",
      "close",
      String(openIssue),
      "--comment",
      `Stand ${day}: der Audit ist wieder sauber und keine Ausnahme läuft in den nächsten ${WARN_DAYS} Tagen ab. [Lauf ansehen](${runUrl})`,
    ]);
  }
  return { action, failed, expiring };
}

function realGh(args, stdin) {
  const result = spawnSync("gh", args, { encoding: "utf8", input: stdin });
  if (result.status !== 0) {
    throw new Error(`gh ${args.slice(0, 2).join(" ")} endete mit ${result.status}: ${(result.stderr ?? "").trim()}`);
  }
  return result.stdout;
}

function main() {
  const { AUDIT_STATUS, AUDIT_LOG, AUDIT_SIMULATED, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  if (!AUDIT_STATUS) {
    console.error("audit-issue: AUDIT_STATUS fehlt.");
    process.exit(2);
  }
  const log = AUDIT_LOG && existsSync(AUDIT_LOG) ? readFileSync(AUDIT_LOG, "utf8") : "";
  const runUrl = `${GITHUB_SERVER_URL ?? "https://github.com"}/${GITHUB_REPOSITORY ?? ""}/actions/runs/${GITHUB_RUN_ID ?? ""}`;
  const { action } = run({
    status: AUDIT_STATUS,
    log,
    simulated: AUDIT_SIMULATED === "true",
    runUrl,
    gh: realGh,
  });
  console.log(`audit-issue: ${action}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
