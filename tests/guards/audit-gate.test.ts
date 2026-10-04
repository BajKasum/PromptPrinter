import { describe, expect, it } from "vitest";
import { ACCEPTED, advisoriesOf, evaluate } from "../../scripts/audit-gate.mjs";

// Das Audit-Gate (scripts/audit-gate.mjs) ist die Schranke, an der die CI
// hängt. Eine Schranke, die man nicht prüft, ist eine Behauptung (dieselbe
// Lehre wie bei Turnstile): getestet wird deshalb vor allem, dass sie NICHT
// durchlässt, was sie nicht durchlassen darf.

const BRACES_URL = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";

/** Die Form, in der `npm audit --json` den braces-Fund am 04.10.2026 geliefert hat. */
const bracesReport = {
  vulnerabilities: {
    braces: {
      via: [
        {
          source: 1240992,
          name: "braces",
          title: "braces vulnerable to stack-exhaustion denial of service through deeply nested patterns",
          url: BRACES_URL,
          severity: "high",
        },
      ],
    },
    chokidar: { via: ["braces"] },
    micromatch: { via: ["braces"] },
    tailwindcss: { via: ["chokidar", "fast-glob", "micromatch"] },
    "fast-glob": { via: ["micromatch"] },
  },
};

function report(...advisories: { url: string; severity: string; name?: string }[]) {
  return {
    vulnerabilities: Object.fromEntries(
      advisories.map((a, i) => [a.name ?? `pkg${i}`, { via: [{ name: a.name ?? `pkg${i}`, ...a }] }])
    ),
  };
}

describe("advisoriesOf", () => {
  it("zählt nur echte Advisories, nicht die Pakete, die sie bloß einbinden", () => {
    const found = advisoriesOf(bracesReport);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: "GHSA-vfj7-8cjw-p6xm", pkg: "braces", severity: "high" });
  });

  it("zählt dasselbe Advisory nur einmal, auch wenn mehrere Pakete es melden", () => {
    const twice = {
      vulnerabilities: {
        a: { via: [{ name: "x", url: BRACES_URL, severity: "high" }] },
        b: { via: [{ name: "x", url: BRACES_URL, severity: "high" }] },
      },
    };
    expect(advisoriesOf(twice)).toHaveLength(1);
  });

  it("verträgt einen leeren Bericht", () => {
    expect(advisoriesOf({})).toEqual([]);
    expect(advisoriesOf({ vulnerabilities: {} })).toEqual([]);
  });
});

describe("evaluate", () => {
  const accepted = [{ id: "GHSA-aaaa", pkg: "x", until: "2026-11-04", reason: "r" }];

  it("lässt einen High-Fund ohne Ausnahme NICHT durch", () => {
    const { failing } = evaluate(report({ url: "https://github.com/advisories/GHSA-zzzz", severity: "high" }), {
      accepted,
      today: "2026-10-04",
    });
    expect(failing.map((f) => f.id)).toEqual(["GHSA-zzzz"]);
  });

  it("lässt einen kritischen Fund ohne Ausnahme NICHT durch", () => {
    const { failing } = evaluate(report({ url: "https://github.com/advisories/GHSA-zzzz", severity: "critical" }), {
      accepted,
      today: "2026-10-04",
    });
    expect(failing).toHaveLength(1);
  });

  it("nimmt einen angenommenen Fund bis zum Ablaufdatum heraus, genau diesen", () => {
    const result = evaluate(
      report(
        { url: "https://github.com/advisories/GHSA-aaaa", severity: "high", name: "x" },
        { url: "https://github.com/advisories/GHSA-zzzz", severity: "high", name: "y" }
      ),
      { accepted, today: "2026-10-04" }
    );
    expect(result.tolerated.map((t) => t.id)).toEqual(["GHSA-aaaa"]);
    expect(result.failing.map((f) => f.id)).toEqual(["GHSA-zzzz"]);
  });

  it("gilt am Ablauftag noch, am Tag danach nicht mehr", () => {
    const r = report({ url: "https://github.com/advisories/GHSA-aaaa", severity: "high", name: "x" });
    expect(evaluate(r, { accepted, today: "2026-11-04" }).failing).toEqual([]);
    const after = evaluate(r, { accepted, today: "2026-11-05" });
    expect(after.failing).toHaveLength(1);
    expect(after.failing[0].why).toMatch(/abgelaufen/);
  });

  it("ignoriert Funde unterhalb der Schwelle", () => {
    const { failing } = evaluate(report({ url: "https://github.com/advisories/GHSA-zzzz", severity: "moderate" }), {
      accepted,
      today: "2026-10-04",
    });
    expect(failing).toEqual([]);
  });

  it("behandelt einen unbekannten Schweregrad als zu hoch, nicht als zu niedrig", () => {
    const { failing } = evaluate(report({ url: "https://github.com/advisories/GHSA-zzzz", severity: "bogus" }), {
      accepted,
      today: "2026-10-04",
    });
    expect(failing).toHaveLength(1);
  });

  it("meldet Einträge, die der Bericht nicht mehr kennt, als veraltet", () => {
    const { stale } = evaluate({ vulnerabilities: {} }, { accepted, today: "2026-10-04" });
    expect(stale.map((s) => s.id)).toEqual(["GHSA-aaaa"]);
  });
});

describe("ACCEPTED (die echte Liste)", () => {
  it("nimmt den braces-Fund von heute heraus, und nur den", () => {
    const { failing, tolerated } = evaluate(bracesReport, { today: "2026-10-04" });
    expect(failing).toEqual([]);
    expect(tolerated.map((t) => t.id)).toEqual(["GHSA-vfj7-8cjw-p6xm"]);
  });

  it("scheitert wieder, sobald die Ausnahme abgelaufen ist", () => {
    const { failing } = evaluate(bracesReport, { today: "2026-11-05" });
    expect(failing.map((f) => f.id)).toEqual(["GHSA-vfj7-8cjw-p6xm"]);
  });

  it("trägt zu jedem Eintrag ein echtes Datum und eine ausgeschriebene Begründung", () => {
    for (const entry of ACCEPTED) {
      expect(entry.until, entry.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(entry.until).getTime()), `${entry.id}: kein Datum`).toBe(false);
      // Eine Begründung, die nur "später beheben" sagt, ist keine: sie muss
      // belegen, warum der Fund die ausgelieferte App nicht erreicht.
      expect(entry.reason.length, `${entry.id}: Begründung zu kurz`).toBeGreaterThan(80);
    }
  });
});
