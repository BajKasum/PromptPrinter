/**
 * Das Audit-Gate: `npm audit`, aber nach Baum getrennt. Zwei Bäume, zwei Regeln.
 *
 * ─── Die Regel (Kasum, 2026-10-20) ──────────────────────────────────────────
 * 1. **Der ausgelieferte Baum** (`npm audit --omit=dev`): jeder Fund ab "high"
 *    lässt das Gate scheitern. Keine Ausnahmen, keine Fristen.
 * 2. **Der Rest, also nur Entwicklungswerkzeuge** (Lint, Tests, Build): ein Fund
 *    ab "high" lässt das Gate scheitern, wenn es eine gepatchte Version gibt
 *    (dann wird sie angehoben). Gibt es keine, wird der Fund **gemeldet und
 *    blockiert nicht**: wer einen Fund nicht beheben kann, darf deshalb nicht
 *    jeden Merge blockieren, und ein Werkzeug, das nie ausgeliefert wird, ist
 *    nicht die Stelle, an der er jemandem schadet.
 *
 * ─── Warum es das gibt ──────────────────────────────────────────────────────
 * Die CI führte `npm audit --audit-level=high` und sonst nichts. Das kennt nur
 * "sauber" und "rot". Am 04.10.2026 erschien GHSA-vfj7-8cjw-p6xm für `braces`
 * (Stack-Erschöpfung bei tief verschachtelten Glob-Mustern, CVSS 7.5) mit
 * `first_patched_version: null`: betroffen sind ALLE Versionen, eine gepatchte
 * gibt es nicht. Jeder Push auf jeden Branch wäre rot gewesen, bis Upstream
 * nachzieht. Bis zum 20.10.2026 half eine befristete Ausnahmeliste (`ACCEPTED`,
 * höchstens 30 Tage, dann neu entscheiden). Sie wurde nie die Lösung: Tailwind 4
 * (die erste Hoffnung) beseitigte den Fund nicht, er hängt auch an
 * `eslint-config-next`, und Next 16 bindet dasselbe `fast-glob` ein. Die Liste
 * wäre monatlich verlängert worden, bis jemand es vergisst. Seither entscheidet
 * der Baum statt eines Datums.
 *
 * ─── Warum zwei Aufrufe und nicht `--omit=dev` oder eine höhere Schwelle ────
 * `--omit=dev` allein prüfte nur noch den ausgelieferten Baum und ließe jeden
 * Fund in den Werkzeugen still durch, auch einen, den ein Update behebt. Eine
 * Schwelle von `critical` ließe jeden künftigen High-Fund durch, auch einen im
 * ausgelieferten Baum. Zwei Aufrufe (alles, und ohne Entwicklungsabhängigkeiten)
 * trennen die Funde sauber: was im zweiten steht, wird ausgeliefert.
 *
 * ─── Wie "keine gepatchte Version" erkannt wird ─────────────────────────────
 * Am Knoten des betroffenen Pakets im Bericht (`vulnerabilities.<paket>.range`):
 * `*` heißt, jede veröffentlichte Version ist betroffen. Das ist genau der Fall
 * "nichts zum Anheben". Der Bereich des Advisorys selbst (`via[].range`) taugt
 * dafür nicht, `<=3.0.3` sagt nicht, ob es eine 3.0.4 gibt. Ein Fund ohne lesbaren
 * Bereich zählt als behebbar, also als blockierend: im Zweifel scheitert das Gate.
 *
 * Usage: node scripts/audit-gate.mjs        (auch: npm run audit:gate)
 * Exit:  0 sauber oder nur gemeldet · 1 offene Funde ·
 *        2 Audit nicht lesbar (Registry nicht erreichbar): schlägt zu, nie auf.
 */

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** @type {Record<string, number>} */
const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

/**
 * @typedef {{ id: string, pkg: string, severity: string, title: string, url: string, range: string }} Advisory
 */

/**
 * Die eigentlichen Advisories eines `npm audit --json`-Berichts.
 *
 * Ein Eintrag unter `vulnerabilities` ist entweder selbst von einem Advisory
 * betroffen (`via` enthält ein Objekt) oder nur weil er etwas Betroffenes
 * einbindet (`via` enthält den Paketnamen als Text). Letztere sind Folgen, keine
 * eigenen Funde: `eslint-config-next` steht im Bericht, weil es `fast-glob`
 * einbindet, das `micromatch` einbindet, das `braces` einbindet. Gezählt wird
 * deshalb nur, was als Objekt auftaucht, und `range` ist der Bereich des
 * Knotens, an dem es auftaucht (siehe oben, "keine gepatchte Version").
 *
 * @param {{ vulnerabilities?: Record<string, { range?: string, via?: unknown[] }> }} report
 * @returns {Advisory[]}
 */
export function advisoriesOf(report) {
  const found = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via !== "object" || via === null) continue;
      const advisory = /** @type {Record<string, unknown>} */ (via);
      const url = String(advisory.url ?? "");
      const id = url.split("/").pop() || String(advisory.source ?? "unbekannt");
      if (found.has(id)) continue;
      found.set(id, {
        id,
        pkg: String(advisory.name ?? "unbekannt"),
        severity: String(advisory.severity ?? "unknown"),
        title: String(advisory.title ?? ""),
        url,
        range: String(vulnerability.range ?? ""),
      });
    }
  }
  return [...found.values()];
}

/**
 * Jede veröffentlichte Version des Pakets ist betroffen: nichts zum Anheben.
 * Ein leerer oder unlesbarer Bereich gilt als "es gibt vielleicht eine", also
 * nicht als ohne Fix.
 *
 * @param {string} range
 */
export function isUnpatched(range) {
  const r = range.trim();
  return r === "*" || r === ">=0.0.0" || r === ">=0";
}

/**
 * @param {Parameters<typeof advisoriesOf>[0]} full  `npm audit --json`: alle Bäume
 * @param {Parameters<typeof advisoriesOf>[0]} prod  `npm audit --omit=dev --json`: nur, was ausgeliefert wird
 * @param {{ level?: string }} [options]
 * @returns {{ failing: (Advisory & { why: string })[], reported: Advisory[] }}
 */
export function evaluate(full, prod, options = {}) {
  const { level = "high" } = options;
  const threshold = RANK[level] ?? RANK.high;
  // Ein unbekannter Schweregrad zählt als zu hoch, nicht als zu niedrig.
  const reaches = (/** @type {Advisory} */ a) => (RANK[a.severity] ?? RANK.critical) >= threshold;

  const prodFound = advisoriesOf(prod).filter(reaches);
  const prodIds = new Set(prodFound.map((a) => a.id));

  const failing = prodFound.map((a) => ({
    ...a,
    why: "im ausgelieferten Baum (npm audit --omit=dev), dort gibt es keine Ausnahmen",
  }));
  const reported = [];

  for (const advisory of advisoriesOf(full).filter(reaches)) {
    if (prodIds.has(advisory.id)) continue;
    if (isUnpatched(advisory.range)) reported.push(advisory);
    else failing.push({ ...advisory, why: "nur ein Entwicklungswerkzeug, aber es gibt eine gepatchte Version: anheben" });
  }

  return { failing, reported };
}

/** @param {string} command */
function runAudit(command) {
  const options = { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 };
  // Unter Windows ist npm eine .cmd-Datei und braucht eine Shell. Der Befehl
  // geht dann als EIN String durch, nicht als Argumentliste: Node warnt bei
  // `shell: true` mit Argumenten (DEP0190), und hier gibt es keine, die
  // maskiert werden müssten.
  const result =
    process.platform === "win32"
      ? spawnSync(command, { ...options, shell: true })
      : spawnSync(command.split(" ")[0], command.split(" ").slice(1), options);
  // npm audit endet mit 1, sobald es etwas findet. Der Exit-Code sagt hier also
  // nichts, gelesen wird der Bericht.
  try {
    const report = JSON.parse(result.stdout);
    if (report.error) throw new Error(report.error.summary ?? "npm audit meldet einen Fehler");
    return report;
  } catch (error) {
    console.error(
      `audit-gate: "${command}" lieferte keinen lesbaren Bericht ` +
        `(${error instanceof Error ? error.message : error}). Das Gate schlägt zu.`
    );
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(2);
  }
}

function main() {
  const { failing, reported } = evaluate(runAudit("npm audit --json"), runAudit("npm audit --omit=dev --json"));

  for (const r of reported) {
    console.log(`  gemeldet, blockiert nicht  ${r.id}  ${r.pkg} (${r.severity})`);
    if (r.title) console.log(`    ${r.title}`);
    console.log(
      "    Nur ein Entwicklungswerkzeug, und jede Version des Pakets ist betroffen: es gibt nichts zum Anheben. " +
        "Gilt, bis das Paket oder das, was es einbindet, einen Fix bringt."
    );
  }
  for (const f of failing) {
    console.error(`  OFFEN  ${f.id}  ${f.pkg} (${f.severity}), ${f.why}`);
    if (f.title) console.error(`    ${f.title}`);
    if (f.url) console.error(`    ${f.url}`);
  }

  if (failing.length > 0) {
    console.error(`\naudit-gate: ${failing.length} Fund(e) ab Schwelle "high", die blockieren.`);
    process.exit(1);
  }
  console.log(
    reported.length > 0
      ? `\naudit-gate: sauber, ${reported.length} Fund(e) nur in Entwicklungswerkzeugen ohne gepatchte Version gemeldet (siehe oben).`
      : "\naudit-gate: sauber."
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
