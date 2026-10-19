import { describe, expect, it } from "vitest";
import * as z from "./zod";

// #134: zod prüft beim ersten Objektschema mit `Function("")`, ob `eval` erlaubt ist. Die CSP verbietet es, der
// Browser meldete die (abgefangene) Probe auf jeder Seite mit einem Formular als Verstoss. Im Browser stellt der
// Wrapper deshalb `jitless` ein, und die Probe fällt weg. Diese Datei läuft in jsdom (`window` ist da), also im
// Zustand des Browsers; `zod.test.ts` daneben läuft in Node.

describe("zod im Browser: keine eval-Probe", () => {
  it("läuft in einer Umgebung mit window", () => {
    expect(typeof window).toBe("object");
  });

  it("ruft Function() nicht auf, auch nicht beim Prüfen eines Objekts", () => {
    const original = globalThis.Function;
    const calls: unknown[][] = [];
    globalThis.Function = new Proxy(original, {
      apply(target, thisArg, args) {
        calls.push(args);
        return Reflect.apply(target, thisArg, args);
      },
      construct(target, args, newTarget) {
        calls.push(args);
        return Reflect.construct(target, args, newTarget);
      },
    });
    try {
      const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
      expect(schema.safeParse({ email: "a@b.test", password: "x" }).success).toBe(true);
      expect(schema.safeParse({ email: "kaputt", password: "" }).success).toBe(false);
    } finally {
      globalThis.Function = original;
    }
    expect(calls).toEqual([]);
  });
});
