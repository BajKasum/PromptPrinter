import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Aus `profiles.plan` wird ein `PlanKey` nur in `src/shared/lib/plans.ts` (#141).
//
// Fünf Stellen schrieben die Zeile `raw === "pro" || raw === "team" ? raw : "free"` von Hand, obwohl `toPlanKey()`
// sie schon konnte; dazu kamen Kopien der Folge "Plan, Admin, wirksame Limits". Kommt ein Plan dazu oder ändert
// sich die Regel für Admins, hätte eine vergessene Kopie ein Limit falsch durchgesetzt. Jetzt gibt es
// `toPlanKey()` für den Wert und `resolvePlan()` für die ganze Folge; dieser Guard hält die Kopien draußen.
const ROOT = process.cwd();
const OWNER = "src/shared/lib/plans.ts";

// `x === "pro" || x === "team"` (und die umgekehrte Reihenfolge), mit beliebigem Ausdruck links.
const HAND_ROLLED_PLAN =
  /(["'])(?:pro|team)\1\s*\|\|[^;\n]{0,80}?===?\s*(["'])(?:team|pro)\2|===?\s*(["'])(?:pro|team)\3\s*\|\|[^;\n]{0,80}?===?\s*(["'])(?:team|pro)\4/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("Plan aus dem Profil nur über plans.ts", () => {
  it("keine Datei in src/ schreibt `=== \"pro\" || … === \"team\"` selbst", () => {
    const files = sourceFiles(join(ROOT, "src"));
    expect(files.length).toBeGreaterThan(100);

    const offenders = files
      .map((file) => relative(ROOT, file).replace(/\\/g, "/"))
      .filter((file) => file !== OWNER)
      .filter((file) => HAND_ROLLED_PLAN.test(readFileSync(join(ROOT, file), "utf8")));

    expect(
      offenders,
      `Diese Dateien normalisieren den Plan von Hand. Nimm toPlanKey() oder resolvePlan() aus ` +
        `${OWNER}:\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  it("erkennt die handgeschriebene Zeile in beiden Reihenfolgen, und die Funktionsaufrufe nicht", () => {
    for (const bad of [
      `const plan = raw === "pro" || raw === "team" ? raw : "free";`,
      `const plan = raw === 'team' || raw === 'pro' ? raw : 'free';`,
      `profile?.plan === "pro" || profile?.plan === "team"`,
      `plan == "pro" || plan == "team"`,
    ]) {
      expect(HAND_ROLLED_PLAN.test(bad), bad).toBe(true);
    }
    for (const fine of [
      `const planKey = toPlanKey(profile?.plan);`,
      `const { plan, isAdmin } = resolvePlan(profile);`,
      `if (plan === "pro") return;`,
      `if (kind === "team") return;`,
    ]) {
      expect(HAND_ROLLED_PLAN.test(fine), fine).toBe(false);
    }
  });
});
