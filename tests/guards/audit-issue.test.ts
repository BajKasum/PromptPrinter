import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LABEL,
  MAX_LOG_CHARS,
  TITLE,
  WARN_DAYS,
  bodyFor,
  excerpt,
  expiringSoon,
  plan,
  run,
} from "../../scripts/audit-issue.mjs";
import { ACCEPTED } from "../../scripts/audit-gate.mjs";

// Der tägliche Audit (.github/workflows/audit.yml) meldet über
// scripts/audit-issue.mjs. Der Meldeweg läuft nachts um 4:37 und sieht niemand,
// ein Fehler darin bliebe also genau so lange unbemerkt, bis das Advisory, vor
// dem er warnen sollte, jemanden getroffen hat. Getestet wird deshalb der ganze
// Ablauf mit einem ersetzten `gh`, vor allem die Fälle, in denen er still
// falsch liegen könnte: ein zweites Issue statt einer Ergänzung, ein Issue, das
// nie schließt, ein Lauf, der "nichts geprüft" als sauber meldet.

const ROOT = join(__dirname, "..", "..");
const RUN_URL = "https://github.com/BajKasum/PromptPrinter/actions/runs/1";

/** Ersetztes `gh`: merkt sich jeden Aufruf, antwortet auf `issue list` mit `open`. */
function fakeGh(open: { number: number; title: string }[] = []) {
  const calls: { args: string[]; stdin?: string }[] = [];
  const gh = (args: string[], stdin?: string) => {
    calls.push({ args, stdin });
    if (args[0] === "issue" && args[1] === "list") return JSON.stringify(open);
    return "";
  };
  return { gh, calls };
}

const verbs = (calls: { args: string[] }[]) => calls.map((c) => c.args.slice(0, 2).join(" "));

const NOT_EXPIRING = [{ id: "GHSA-aaaa", pkg: "x", until: "2026-12-31" }];
const EXPIRING = [{ id: "GHSA-bbbb", pkg: "braces", until: "2026-10-10" }];
const TODAY = "2026-10-06";

describe("expiringSoon", () => {
  const entry = (until: string) => [{ id: "GHSA-x", pkg: "x", until }];

  it("meldet eine Ausnahme, die in höchstens 7 Tagen abläuft, mit den Resttagen", () => {
    const [e] = expiringSoon(entry("2026-10-13"), TODAY);
    expect(e.daysLeft).toBe(7);
  });

  it("meldet eine Ausnahme, die heute abläuft (der Audit lässt sie heute noch durch)", () => {
    expect(expiringSoon(entry(TODAY), TODAY)).toHaveLength(1);
  });

  it("schweigt bei einer, die noch länger hält", () => {
    expect(expiringSoon(entry("2026-10-14"), TODAY)).toEqual([]);
  });

  it("schweigt bei einer abgelaufenen: die lässt den Audit selbst scheitern", () => {
    expect(expiringSoon(entry("2026-10-05"), TODAY)).toEqual([]);
  });

  it("meldet jede echte Ausnahme aus audit-gate.mjs ab 7 Tagen vor ihrem Ablauf, nicht früher", () => {
    // Die echte Liste, nicht eine Kopie: ändert jemand ein Datum, prüft dieser
    // Test die neue Grenze.
    expect(ACCEPTED.length).toBeGreaterThan(0);
    for (const entry of ACCEPTED) {
      const dayBefore = (n: number) => new Date(Date.parse(entry.until) - n * 86_400_000).toISOString().slice(0, 10);
      const ids = (today: string) => expiringSoon(ACCEPTED, today).map((e) => e.id);
      expect(ids(dayBefore(8)), entry.id).not.toContain(entry.id);
      expect(ids(dayBefore(7)), entry.id).toContain(entry.id);
      expect(ids(dayBefore(0)), entry.id).toContain(entry.id);
      expect(ids(dayBefore(-1)), entry.id).not.toContain(entry.id);
    }
  });
});

describe("plan", () => {
  const cases: [string, Parameters<typeof plan>[0], ReturnType<typeof plan>][] = [
    ["Fehlschlag, noch kein Issue → anlegen", { failed: true, expiring: [], openIssue: null }, "create"],
    ["Fehlschlag, Issue offen → ergänzen (kein zweites)", { failed: true, expiring: [], openIssue: 7 }, "comment"],
    ["nur eine ablaufende Ausnahme, kein Issue → anlegen", { failed: false, expiring: [1], openIssue: null }, "create"],
    ["nur eine ablaufende Ausnahme, Issue offen → ergänzen", { failed: false, expiring: [1], openIssue: 7 }, "comment"],
    ["alles sauber, Issue offen → schließen", { failed: false, expiring: [], openIssue: 7 }, "close"],
    ["alles sauber, kein Issue → nichts", { failed: false, expiring: [], openIssue: null }, "none"],
  ];
  it.each(cases)("%s", (_name, state, expected) => {
    expect(plan(state)).toBe(expected);
  });
});

describe("run (der ganze Ablauf mit ersetztem gh)", () => {
  it("legt bei einem Fehlschlag EIN Issue an, mit Label, Titel und dem Protokoll", () => {
    const { gh, calls } = fakeGh();
    const result = run({
      status: "failure",
      log: "OFFEN  GHSA-zzzz  foo (high)",
      simulated: false,
      runUrl: RUN_URL,
      today: TODAY,
      accepted: NOT_EXPIRING,
      gh,
    });
    expect(result.action).toBe("create");
    expect(verbs(calls)).toEqual(["issue list", "label create", "issue create"]);
    const create = calls.find((c) => c.args[1] === "create" && c.args[0] === "issue")!;
    expect(create.args).toEqual(expect.arrayContaining(["--title", TITLE, "--label", LABEL]));
    expect(create.stdin).toContain("OFFEN  GHSA-zzzz  foo (high)");
    expect(create.stdin).toContain(RUN_URL);
  });

  it("ergänzt bei einem Folgefehlschlag das offene Issue, statt ein zweites anzulegen", () => {
    const { gh, calls } = fakeGh([{ number: 12, title: TITLE }]);
    const result = run({ status: "failure", log: "x", simulated: false, runUrl: RUN_URL, today: TODAY, accepted: NOT_EXPIRING, gh });
    expect(result.action).toBe("comment");
    expect(verbs(calls)).toEqual(["issue list", "issue comment"]);
    expect(calls[1].args[2]).toBe("12");
    expect(verbs(calls)).not.toContain("issue create");
  });

  it("schließt das Issue, sobald der Audit wieder sauber ist", () => {
    const { gh, calls } = fakeGh([{ number: 12, title: TITLE }]);
    const result = run({ status: "success", log: "", simulated: false, runUrl: RUN_URL, today: TODAY, accepted: NOT_EXPIRING, gh });
    expect(result.action).toBe("close");
    expect(calls[1].args.slice(0, 3)).toEqual(["issue", "close", "12"]);
  });

  it("tut bei sauberem Lauf ohne offenes Issue nichts außer nachzusehen", () => {
    const { gh, calls } = fakeGh();
    const result = run({ status: "success", log: "", simulated: false, runUrl: RUN_URL, today: TODAY, accepted: NOT_EXPIRING, gh });
    expect(result.action).toBe("none");
    expect(verbs(calls)).toEqual(["issue list"]);
  });

  it("zählt einen Lauf, der den Audit nie erreicht hat (skipped), als Fehlschlag, nie als sauber", () => {
    for (const status of ["skipped", "cancelled", "failure", ""]) {
      const { gh } = fakeGh();
      const result = run({ status, log: "", simulated: false, runUrl: RUN_URL, today: TODAY, accepted: NOT_EXPIRING, gh });
      expect(result.failed, `status "${status}"`).toBe(true);
      expect(result.action, `status "${status}"`).toBe("create");
    }
  });

  it("warnt bei grünem Audit, wenn eine Ausnahme in 7 Tagen abläuft, und nennt sie im Issue", () => {
    const { gh, calls } = fakeGh();
    const result = run({ status: "success", log: "", simulated: false, runUrl: RUN_URL, today: TODAY, accepted: EXPIRING, gh });
    expect(result.action).toBe("create");
    const create = calls.find((c) => c.args[0] === "issue" && c.args[1] === "create")!;
    expect(create.stdin).toContain("GHSA-bbbb");
    expect(create.stdin).toContain("2026-10-10");
    // Der Audit selbst war grün: kein "gescheitert" im Text.
    expect(create.stdin).not.toContain("gescheitert");
  });

  it("fasst ein Issue mit gleichem Label, aber anderem Titel nie an", () => {
    const { gh, calls } = fakeGh([{ number: 3, title: "Von Hand angelegt, gleiches Label" }]);
    const result = run({ status: "failure", log: "x", simulated: false, runUrl: RUN_URL, today: TODAY, accepted: NOT_EXPIRING, gh });
    expect(result.action).toBe("create");
    expect(verbs(calls)).not.toContain("issue comment");
    expect(verbs(calls)).not.toContain("issue close");
  });

  it("kennzeichnet eine Simulation als solche", () => {
    const { gh, calls } = fakeGh();
    run({ status: "failure", log: "SIMULATION", simulated: true, runUrl: RUN_URL, today: TODAY, accepted: NOT_EXPIRING, gh });
    const create = calls.find((c) => c.args[0] === "issue" && c.args[1] === "create")!;
    expect(create.stdin).toMatch(/Simulation/);
  });
});

describe("excerpt und bodyFor", () => {
  it("kürzt ein langes Protokoll", () => {
    const out = excerpt("a".repeat(MAX_LOG_CHARS * 2));
    expect(out.length).toBeLessThan(MAX_LOG_CHARS + 50);
    expect(out).toMatch(/gekürzt/);
  });

  it("lässt drei Backticks aus fremdem Text nie den Codeblock beenden", () => {
    expect(excerpt("titel ``` ende")).not.toContain("```");
    const body = bodyFor({ failed: true, expiring: [], log: "x ``` y", runUrl: RUN_URL, today: TODAY, simulated: false });
    // Genau ein öffnender und ein schließender Zaun.
    expect(body.match(/```/g)).toHaveLength(2);
  });

  it("sagt bei fehlendem Protokoll, was los ist, statt eines leeren Blocks", () => {
    expect(excerpt("")).toMatch(/kein Protokoll/);
    expect(excerpt(undefined as unknown as string)).toMatch(/kein Protokoll/);
  });

  it("warnt eine Woche vor Ablauf, nicht früher (Konstante festgehalten)", () => {
    expect(WARN_DAYS).toBe(7);
  });
});

describe("audit.yml", () => {
  // Auf Windows liefert git die Datei mit CRLF aus, die Muster unten rechnen mit LF.
  const workflow = readFileSync(join(ROOT, ".github", "workflows", "audit.yml"), "utf8").replaceAll("\r\n", "\n");
  const code = workflow
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");

  it("läuft täglich und von Hand, nie bei einem Push oder Pull Request", () => {
    expect(code).toMatch(/schedule:\s*\n\s*- cron:/);
    expect(code).toMatch(/workflow_dispatch:/);
    // Ein PR aus einem Fork bekäme sonst Issue-Schreibrechte in die Nähe von
    // Fremdcode, und ein Push würde jeden Branch zusätzlich prüfen (ci.yml tut es).
    expect(code).not.toMatch(/^\s*push:/m);
    expect(code).not.toMatch(/^\s*pull_request/m);
  });

  it("hat nur die Rechte, die es braucht: Quelltext lesen, Issues schreiben", () => {
    // Der Block auf oberster Ebene: Zeilen, die um zwei Leerzeichen eingerückt sind.
    const block = code.match(/^permissions:\n((?: {2}\S.*\n)+)/m);
    expect(block, "kein permissions-Block auf oberster Ebene").not.toBeNull();
    const entries = block![1]
      .split("\n")
      .filter(Boolean)
      .map((l) => l.trim());
    expect(entries.sort()).toEqual(["contents: read", "issues: write"]);
  });

  it("prüft mit dem Gate der CI (audit-gate.mjs), nicht mit einer eigenen Schwelle", () => {
    expect(code).toContain("node scripts/audit-gate.mjs");
    // Nur ausgeführte Befehle zählen (der Jobname darf "npm audit" nennen).
    expect(code).not.toMatch(/^\s*(?:-\s*)?run:.*npm audit|^\s+npm audit/m);
  });

  it("meldet auch dann, wenn der Audit scheitert oder gar nicht erst lief", () => {
    expect(code).toMatch(/continue-on-error:\s*true/);
    expect(code).toMatch(/if:\s*always\(\)/);
    expect(code).toMatch(/AUDIT_STATUS:\s*\$\{\{\s*steps\.audit\.outcome\s*\}\}/);
  });

  it("färbt den Lauf selbst rot, wenn der Audit nicht sauber war", () => {
    expect(code).toMatch(/if:\s*steps\.audit\.outcome != 'success'/);
  });

  it("legt den Test-Schalter als echten Boolean an", () => {
    expect(code).toMatch(/simulate_failure:[\s\S]*?type:\s*boolean/);
  });

  it("lässt zwei Läufe nicht gleichzeitig laufen (sonst zwei Issues)", () => {
    expect(code).toMatch(/concurrency:\s*\n\s*group:\s*audit\s*\n\s*cancel-in-progress:\s*false/);
  });
});
