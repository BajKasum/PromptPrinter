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
 * Der Audit ist gescheitert: ein Fund, der blockiert (im ausgelieferten Baum
 * oder in einem Werkzeug mit gepatchter Version), die Registry war nicht
 * erreichbar, oder der Lauf kam gar nicht bis zum Audit. Funde nur in
 * Entwicklungswerkzeugen ohne gepatchte Version (scripts/audit-gate.mjs) stehen
 * im Protokoll, sind aber keines: es gäbe nichts zu entscheiden, das Issue bliebe
 * offen, bis Upstream nachzieht. Bis zum 20.10.2026 meldete dieses Skript auch
 * eine befristete Ausnahme, die in sieben Tagen abläuft. Die Ausnahmeliste gibt
 * es nicht mehr, also auch diese Warnung nicht.
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

export const TITLE = "Audit: Abhängigkeiten brauchen eine Entscheidung";
export const LABEL = "audit";
/** Mehr passt in kein lesbares Issue, und das Wichtige steht in den ersten Zeilen. */
export const MAX_LOG_CHARS = 3000;

/** @param {Date | string} today */
function dayOf(today) {
  return (today instanceof Date ? today : new Date(today)).toISOString().slice(0, 10);
}

/**
 * Was mit dem Issue zu tun ist.
 *
 * @param {{ failed: boolean, openIssue: number | null }} state
 * @returns {"create" | "comment" | "close" | "none"}
 */
export function plan({ failed, openIssue }) {
  if (failed) return openIssue === null ? "create" : "comment";
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
 *   log: string,
 *   runUrl: string,
 *   today: string,
 *   simulated: boolean,
 * }} input
 */
export function bodyFor({ log, runUrl, today, simulated }) {
  const lines = [];
  if (simulated) {
    lines.push(
      "> **Simulation.** Dieser Lauf wurde von Hand mit `simulate_failure` gestartet, um den Meldeweg zu prüfen. Es gibt keinen echten Fund.",
      ""
    );
  }
  lines.push(
    `### Stand ${today}`,
    "",
    "Der tägliche Audit ist **gescheitert**. Ausgabe von `npm run audit:gate`:",
    "",
    "```text",
    excerpt(log),
    "```",
    "",
    "Entscheiden: gepatchte Version anheben, oder (nur bei einem Entwicklungswerkzeug ohne gepatchte Version) nichts, das Gate meldet es dann ohne zu blockieren.",
    "",
    `[Lauf ansehen](${runUrl})`
  );
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
 *   gh: (args: string[], stdin?: string) => string,
 * }} input
 */
export function run({ status, log, simulated, runUrl, today = new Date(), gh }) {
  // Alles außer einem ausdrücklichen "success" zählt als Fehlschlag, auch
  // "skipped" (npm ci scheiterte, der Audit lief nie): ein Lauf, der nichts
  // geprüft hat, darf nie grün aussehen.
  const failed = status !== "success";
  const day = dayOf(today);

  const listed = JSON.parse(
    gh(["issue", "list", "--label", LABEL, "--state", "open", "--json", "number,title", "--limit", "50"]) || "[]"
  );
  const open = listed.find((issue) => issue.title === TITLE);
  const openIssue = open ? open.number : null;

  const action = plan({ failed, openIssue });

  if (action === "create") {
    // --force: legt das Label an oder aktualisiert es, ohne bei "gibt es schon"
    // zu scheitern.
    gh(["label", "create", LABEL, "--force", "--color", "B60205", "--description", "Meldung des täglichen Abhängigkeits-Audits"]);
    gh(["issue", "create", "--title", TITLE, "--label", LABEL, "--body-file", "-"], bodyFor({ log, runUrl, today: day, simulated }));
  } else if (action === "comment") {
    gh(["issue", "comment", String(openIssue), "--body-file", "-"], bodyFor({ log, runUrl, today: day, simulated }));
  } else if (action === "close") {
    gh(["issue", "close", String(openIssue), "--comment", `Stand ${day}: der Audit ist wieder sauber. [Lauf ansehen](${runUrl})`]);
  }
  return { action, failed };
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
