import { describe, expect, it } from "vitest";
import { advisoriesOf, evaluate, isUnpatched } from "../../scripts/audit-gate.mjs";

// Das Audit-Gate (scripts/audit-gate.mjs) ist die Schranke, an der die CI
// hängt. Eine Schranke, die man nicht prüft, ist eine Behauptung (dieselbe
// Lehre wie bei Turnstile): getestet wird deshalb vor allem, dass sie NICHT
// durchlässt, was sie nicht durchlassen darf. Seit 2026-10-20 trennt sie nach
// Baum: im ausgelieferten Baum blockiert jeder Fund ab "high", in einem
// Entwicklungswerkzeug nur einer, zu dem es eine gepatchte Version gibt.

const BRACES_URL = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const NEXT_URL = "https://github.com/advisories/GHSA-4jqv-mc3x-m676";

type Node = { range?: string; via: unknown[] };

/**
 * Die Form, in der `npm audit --json` den braces-Fund am 20.10.2026 geliefert hat:
 * der Knoten `braces` trägt das Advisory (`range: "*"`, jede Version betroffen), die
 * übrigen Knoten binden ihn nur ein.
 */
const bracesNodes: Record<string, Node> = {
  braces: {
    range: "*",
    via: [
      {
        source: 1240992,
        name: "braces",
        title: "braces vulnerable to stack-exhaustion denial of service through deeply nested patterns",
        url: BRACES_URL,
        severity: "high",
        range: "<=3.0.3",
      },
    ],
  },
  micromatch: { range: ">=0.2.0", via: ["braces"] },
  "fast-glob": { range: "*", via: ["micromatch"] },
  "eslint-config-next": { range: ">=14.3.0-canary.0", via: ["fast-glob"] },
};

/** Ein Fund mit gepatchter Version: der Bereich des Knotens ist begrenzt. */
const nextNodes: Record<string, Node> = {
  next: {
    range: "15.0.0 - 15.5.26",
    via: [{ name: "next", title: "Cache poisoning", url: NEXT_URL, severity: "high", range: ">=15.0.0 <15.5.27" }],
  },
};

const report = (nodes: Record<string, Node>) => ({ vulnerabilities: nodes });
const EMPTY = report({});

describe("advisoriesOf", () => {
  it("zählt nur echte Advisories, nicht die Pakete, die sie bloß einbinden", () => {
    const found = advisoriesOf(report(bracesNodes));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: "GHSA-vfj7-8cjw-p6xm", pkg: "braces", severity: "high", range: "*" });
  });

  it("trägt den Bereich des Knotens mit, nicht den des Advisorys", () => {
    // `via[].range` ("<=3.0.3") sagt nicht, ob es eine 3.0.4 gibt, der Knoten ("*") sagt es.
    expect(advisoriesOf(report(bracesNodes))[0].range).toBe("*");
    expect(advisoriesOf(report(nextNodes))[0].range).toBe("15.0.0 - 15.5.26");
  });

  it("zählt dasselbe Advisory nur einmal, auch wenn mehrere Pakete es melden", () => {
    const twice = report({
      a: { via: [{ name: "x", url: BRACES_URL, severity: "high" }] },
      b: { via: [{ name: "x", url: BRACES_URL, severity: "high" }] },
    });
    expect(advisoriesOf(twice)).toHaveLength(1);
  });

  it("verträgt einen leeren Bericht", () => {
    expect(advisoriesOf({})).toEqual([]);
    expect(advisoriesOf(EMPTY)).toEqual([]);
  });
});

describe("isUnpatched", () => {
  it("erkennt 'jede Version betroffen', und nur das", () => {
    expect(isUnpatched("*")).toBe(true);
    expect(isUnpatched(">=0.0.0")).toBe(true);
    expect(isUnpatched("15.0.0 - 15.5.26")).toBe(false);
    expect(isUnpatched("<4.17.21")).toBe(false);
  });

  it("hält einen leeren oder unlesbaren Bereich für behebbar, im Zweifel blockiert das Gate", () => {
    expect(isUnpatched("")).toBe(false);
    expect(isUnpatched("irgendwas")).toBe(false);
  });
});

describe("evaluate: ausgelieferter Baum", () => {
  it("lässt einen Fund im ausgelieferten Baum NICHT durch, auch ohne gepatchte Version", () => {
    // Derselbe braces-Fund, nur diesmal auch im Produktionsbericht: blockiert, keine Ausnahme.
    const { failing, reported } = evaluate(report(bracesNodes), report(bracesNodes));
    expect(failing.map((f) => f.id)).toEqual(["GHSA-vfj7-8cjw-p6xm"]);
    expect(failing[0].why).toMatch(/ausgelieferten Baum/);
    expect(reported).toEqual([]);
  });

  it("lässt einen Fund mit gepatchter Version im ausgelieferten Baum NICHT durch", () => {
    const { failing } = evaluate(report(nextNodes), report(nextNodes));
    expect(failing.map((f) => f.id)).toEqual(["GHSA-4jqv-mc3x-m676"]);
  });

  it("lässt einen kritischen Fund NICHT durch", () => {
    const critical = report({ x: { range: "<1.0.0", via: [{ name: "x", url: NEXT_URL, severity: "critical" }] } });
    expect(evaluate(critical, critical).failing).toHaveLength(1);
  });

  it("zählt einen Fund, der nur im Produktionsbericht steht, auch dann", () => {
    // Der volle Bericht ist eine Obermenge. Fehlte der Fund dort, darf er trotzdem nicht verschwinden.
    expect(evaluate(EMPTY, report(nextNodes)).failing.map((f) => f.id)).toEqual(["GHSA-4jqv-mc3x-m676"]);
  });
});

describe("evaluate: Entwicklungswerkzeuge", () => {
  it("meldet einen Fund ohne gepatchte Version, blockiert aber nicht (braces über eslint-config-next)", () => {
    const { failing, reported } = evaluate(report(bracesNodes), EMPTY);
    expect(failing).toEqual([]);
    expect(reported.map((r) => r.id)).toEqual(["GHSA-vfj7-8cjw-p6xm"]);
  });

  it("blockiert einen Fund MIT gepatchter Version, auch in einem Werkzeug", () => {
    const { failing, reported } = evaluate(report(nextNodes), EMPTY);
    expect(failing.map((f) => f.id)).toEqual(["GHSA-4jqv-mc3x-m676"]);
    expect(failing[0].why).toMatch(/gepatchte Version/);
    expect(reported).toEqual([]);
  });

  it("trennt beides in einem Lauf: ein Werkzeug-Fund ohne Fix wird gemeldet, einer mit Fix blockiert", () => {
    const both = report({ ...bracesNodes, ...nextNodes });
    const { failing, reported } = evaluate(both, EMPTY);
    expect(reported.map((r) => r.id)).toEqual(["GHSA-vfj7-8cjw-p6xm"]);
    expect(failing.map((f) => f.id)).toEqual(["GHSA-4jqv-mc3x-m676"]);
  });

  it("blockiert einen Fund ohne lesbaren Bereich (im Zweifel scheitert das Gate)", () => {
    const unknown = report({ x: { via: [{ name: "x", url: NEXT_URL, severity: "high" }] } });
    expect(evaluate(unknown, EMPTY).failing).toHaveLength(1);
  });
});

describe("evaluate: Schwelle", () => {
  const moderate = report({ x: { range: "<1.0.0", via: [{ name: "x", url: NEXT_URL, severity: "moderate" }] } });

  it("ignoriert Funde unterhalb der Schwelle, in beiden Bäumen", () => {
    expect(evaluate(moderate, moderate)).toEqual({ failing: [], reported: [] });
  });

  it("behandelt einen unbekannten Schweregrad als zu hoch, nicht als zu niedrig", () => {
    const bogus = report({ x: { range: "<1.0.0", via: [{ name: "x", url: NEXT_URL, severity: "bogus" }] } });
    expect(evaluate(bogus, bogus).failing).toHaveLength(1);
  });

  it("kennt keine Ausnahmeliste mehr", async () => {
    // Bis 2026-10-20 gab es ACCEPTED mit Ablaufdatum. Taucht sie wieder auf, ist die Regel "ohne Ausnahmen" weg.
    const gate = await import("../../scripts/audit-gate.mjs");
    expect(Object.keys(gate)).not.toContain("ACCEPTED");
  });
});
