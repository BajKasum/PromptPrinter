/**
 * Das Audit-Gate: `npm audit --audit-level=high`, plus eine benannte, befristete
 * Liste bewusst angenommener Advisories.
 *
 * ─── Warum es das gibt ──────────────────────────────────────────────────────
 * Die CI führte `npm audit --audit-level=high` und sonst nichts. Das ist die
 * richtige Schwelle (siehe CI-Kommentar, Security-Audit H-2), aber es kennt nur
 * "sauber" und "rot". Am 04.10.2026 erschien GHSA-vfj7-8cjw-p6xm für `braces`
 * (Stack-Erschöpfung bei tief verschachtelten Glob-Mustern, CVSS 7.5) mit
 * `first_patched_version: null`: betroffen sind ALLE Versionen bis 3.0.3, eine
 * gepatchte gibt es nicht. Die bisherige Antwort für solche Funde (ein
 * `overrides`-Eintrag mit der kleinsten bereinigenden Version) greift hier
 * nicht, weil es keine Version gibt, auf die man heben könnte. npm schlägt nur
 * den Sprung auf tailwindcss 4 vor, einen Major mit Breaking Change.
 *
 * Ohne diese Datei wäre jeder Push auf jeden Branch rot gewesen, bis Upstream
 * nachzieht. Genau die Lage, die CLAUDE.md beschreibt (23.09. und 01.10.2026),
 * nur ohne Ausweg.
 *
 * ─── Warum eine Liste und nicht `--omit=dev` oder eine höhere Schwelle ──────
 * `--omit=dev` hilft nicht: tailwindcss steckt über tailwindcss-animate (eine
 * Produktions-Dependency) im Produktionsbaum und wird trotzdem gemeldet. Eine
 * Schwelle von `critical` würde jeden künftigen High-Fund stillschweigend
 * durchlassen, auch einen, der die ausgelieferte App betrifft. Eine Liste mit
 * Kennung, Begründung und Ablaufdatum nimmt GENAU diesen einen Fund heraus und
 * lässt alles andere so scharf wie vorher.
 *
 * ─── Regeln für Einträge ────────────────────────────────────────────────────
 * - Nur mit Begründung, die belegt, warum der Fund die ausgelieferte App nicht
 *   erreicht (nicht "irgendwann beheben").
 * - Immer mit Ablaufdatum, höchstens ~30 Tage. Danach scheitert das Gate wieder,
 *   und jemand muss neu entscheiden: Upstream-Fix, Major-Sprung oder
 *   Verlängerung mit neuer Begründung. Eine Ausnahme ohne Ende ist keine
 *   Entscheidung mehr, sondern ein vergessener Stand.
 * - Eintrag löschen, sobald der Fund verschwindet (das Skript weist darauf hin).
 *
 * Usage: node scripts/audit-gate.mjs        (auch: npm run audit:gate)
 * Exit:  0 sauber oder alles angenommen · 1 offene/abgelaufene Funde ·
 *        2 Audit nicht lesbar (Registry nicht erreichbar): schlägt zu, nie auf.
 */

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * @typedef {{ id: string, pkg: string, until: string, reason: string }} Accepted
 * @type {Accepted[]}
 */
export const ACCEPTED = [
  {
    id: "GHSA-vfj7-8cjw-p6xm",
    pkg: "braces",
    until: "2026-11-04",
    reason:
      "Nur Build-Werkzeuge: braces hängt an tailwindcss 3.4 (chokidar, micromatch, fast-glob) " +
      "und eslint-config-next (fast-glob). Keine gepatchte Version vorhanden " +
      "(betroffen <= 3.0.3 = alle), npm bietet nur tailwindcss 4 an (Breaking Change). " +
      "Der ausgelieferte Build enthält braces nicht: .next/standalone/node_modules am " +
      "04.10.2026 geprüft, dort fehlen braces, micromatch, tailwindcss, chokidar, fast-glob. " +
      "Ausnutzbar nur mit angreiferkontrollierten Glob-Mustern, die unser Build nie verarbeitet.",
  },
];

/** @type {Record<string, number>} */
const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

/**
 * Die eigentlichen Advisories eines `npm audit --json`-Berichts.
 *
 * Ein Eintrag unter `vulnerabilities` ist entweder selbst von einem Advisory
 * betroffen (`via` enthält ein Objekt) oder nur weil er etwas Betroffenes
 * einbindet (`via` enthält den Paketnamen als Text). Letztere sind Folgen, keine
 * eigenen Funde: tailwindcss steht im Bericht, weil es chokidar einbindet, das
 * braces einbindet. Gezählt wird deshalb nur, was als Objekt auftaucht.
 *
 * @param {{ vulnerabilities?: Record<string, { via?: unknown[] }> }} report
 * @returns {{ id: string, pkg: string, severity: string, title: string, url: string }[]}
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
      });
    }
  }
  return [...found.values()];
}

/**
 * @param {Parameters<typeof advisoriesOf>[0]} report
 * @param {{ accepted?: Accepted[], today?: Date | string, level?: string }} [options]
 */
export function evaluate(report, options = {}) {
  const { accepted = ACCEPTED, today = new Date(), level = "high" } = options;
  const day = (today instanceof Date ? today : new Date(today)).toISOString().slice(0, 10);
  const threshold = RANK[level] ?? RANK.high;

  const failing = [];
  const tolerated = [];
  const seen = new Set();

  for (const advisory of advisoriesOf(report)) {
    seen.add(advisory.id);
    // Ein unbekannter Schweregrad zählt als zu hoch, nicht als zu niedrig.
    const rank = RANK[advisory.severity] ?? RANK.critical;
    if (rank < threshold) continue;

    const entry = accepted.find((a) => a.id === advisory.id);
    if (!entry) {
      failing.push({ ...advisory, why: "nicht angenommen" });
    } else if (entry.until < day) {
      failing.push({ ...advisory, why: `Ausnahme am ${entry.until} abgelaufen` });
    } else {
      tolerated.push({ ...advisory, until: entry.until, reason: entry.reason });
    }
  }

  // Einträge, die der Bericht nicht mehr kennt: der Fund ist behoben oder das
  // Paket weg. Kein Grund zu scheitern, aber ein Grund, aufzuräumen.
  const stale = accepted.filter((a) => !seen.has(a.id));

  return { failing, tolerated, stale };
}

function runAudit() {
  const options = { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 };
  // Unter Windows ist npm eine .cmd-Datei und braucht eine Shell. Der Befehl
  // geht dann als EIN String durch, nicht als Argumentliste: Node warnt bei
  // `shell: true` mit Argumenten (DEP0190), und hier gibt es keine, die
  // maskiert werden müssten.
  const result =
    process.platform === "win32"
      ? spawnSync("npm audit --json", { ...options, shell: true })
      : spawnSync("npm", ["audit", "--json"], options);
  // npm audit endet mit 1, sobald es etwas findet. Der Exit-Code sagt hier also
  // nichts, gelesen wird der Bericht.
  try {
    const report = JSON.parse(result.stdout);
    if (report.error) throw new Error(report.error.summary ?? "npm audit meldet einen Fehler");
    return report;
  } catch (error) {
    console.error(
      "audit-gate: npm audit lieferte keinen lesbaren Bericht " +
        `(${error instanceof Error ? error.message : error}). Das Gate schlägt zu.`
    );
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(2);
  }
}

function main() {
  const { failing, tolerated, stale } = evaluate(runAudit());

  for (const t of tolerated) {
    console.log(`  angenommen bis ${t.until}  ${t.id}  ${t.pkg} (${t.severity})`);
    console.log(`    ${t.reason}`);
  }
  for (const s of stale) {
    console.log(`  Hinweis: ${s.id} (${s.pkg}) steht in ACCEPTED, taucht im Bericht aber nicht mehr auf. Eintrag löschen.`);
  }
  for (const f of failing) {
    console.error(`  OFFEN  ${f.id}  ${f.pkg} (${f.severity}), ${f.why}`);
    if (f.title) console.error(`    ${f.title}`);
    if (f.url) console.error(`    ${f.url}`);
  }

  if (failing.length > 0) {
    console.error(`\naudit-gate: ${failing.length} Fund(e) ab Schwelle "high" ohne gültige Ausnahme.`);
    process.exit(1);
  }
  console.log(
    tolerated.length > 0
      ? `\naudit-gate: sauber, ${tolerated.length} befristete Ausnahme(n) aktiv (siehe oben).`
      : "\naudit-gate: sauber."
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
