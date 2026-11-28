import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { parse, walk } from "@tests/guards/parse-source";
import { problem, rateLimitedProblem } from "./api-problem";

describe("problem", () => {
  it("antwortet als problem+json mit Titel, Status, Satz und Zusatzfeldern", async () => {
    const res = problem(403, "Nein.", { kind: "x" });
    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(await res.json()).toEqual({ type: "about:blank", title: "Forbidden", status: 403, detail: "Nein.", kind: "x" });
  });
});

describe("rateLimitedProblem", () => {
  it("trägt Art, Wartezeit in aufgerundeten Sekunden und denselben Wert im Kopf Retry-After", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const res = rateLimitedProblem("Zu viele.", { resetAt: 1_000_000 + 41_200 });
    vi.useRealTimers();

    expect(res.status).toBe(429);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(res.headers.get("retry-after")).toBe("42");
    expect(await res.json()).toEqual({
      type: "about:blank",
      title: "Too Many Requests",
      status: 429,
      detail: "Zu viele.",
      kind: "rate_limited",
      retryAfter: 42,
    });
  });

  it("schreibt nie eine negative Zahl in den Kopf", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const res = rateLimitedProblem("Zu viele.", { resetAt: 1_000_000 - 5_000 });
    vi.useRealTimers();
    expect(res.headers.get("retry-after")).toBe("0");
  });
});

// Chat, Browser und Terminal-App lesen `kind`, `retryAfter` und den Kopf: eine ausgeschriebene 429 daneben wiche bald ab.
// Zwei Absagen sind kein Ratenlimit und haben keine Wartezeit bis zu einem Zeitfenster.
const OTHER_429 = [
  // Die Terminal-App fragt schneller nach als `interval` (RFC 8628, "slow_down").
  "src/app/api/cli/token/route.ts",
  // Die Anmelde-Bremse je Adresse sagt bewusst nicht, wie lange (server/security/sign-in-throttle.ts).
  "src/app/api/auth/route.ts",
];

describe("429 in den Routen", () => {
  const root = process.cwd();
  const sources = (dir: string): string[] =>
    readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return sources(path);
      return /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : [];
    });

  /** Jede Stelle `problem(429, …)` ausserhalb des Helfers, je Aufruf der Dateipfad. */
  function written429(file: string, text?: string): string[] {
    const found: string[] = [];
    walk(parse(file, text), (node) => {
      if (!ts.isCallExpression(node) || node.expression.getText() !== "problem") return;
      if (node.arguments[0]?.getText() === "429") found.push(file);
    });
    return found;
  }

  it("kommt nur aus rateLimitedProblem, ausser an den zwei benannten Stellen, je einmal", () => {
    const files = [...sources("src/app/api"), "src/server/model-call.ts"];
    expect(files.length).toBeGreaterThan(20);
    const found = files.flatMap((file) => written429(file));
    expect(found.sort()).toEqual([...OTHER_429].sort());
  });

  it("erkennt eine ausgeschriebene Absage", () => {
    expect(written429("route.ts", "return problem(\n  429,\n  m.x\n);")).toHaveLength(1);
    expect(written429("route.ts", "return rateLimitedProblem(m.x, rl);")).toHaveLength(0);
  });
});
