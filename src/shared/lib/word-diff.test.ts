import { describe, expect, it } from "vitest";
import { diffWords, hasChanges, type DiffPart } from "./word-diff";

/** Beide Fassungen müssen aus den Teilen wieder entstehen. */
function rebuild(parts: DiffPart[]): { before: string; after: string } {
  return {
    before: parts.filter((p) => p.kind !== "added").map((p) => p.text).join(""),
    after: parts.filter((p) => p.kind !== "removed").map((p) => p.text).join(""),
  };
}

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe("diffWords", () => {
  it("gibt gleiche Texte als einen gleichen Teil zurück, leere als nichts", () => {
    expect(diffWords("Hallo Welt", "Hallo Welt")).toEqual([{ kind: "same", text: "Hallo Welt" }]);
    expect(diffWords("", "")).toEqual([]);
    expect(hasChanges(diffWords("a", "a"))).toBe(false);
  });

  it("markiert ein eingefügtes, ein entferntes und ein ersetztes Wort", () => {
    expect(diffWords("Schreib einen Brief", "Schreib einen kurzen Brief")).toEqual([
      { kind: "same", text: "Schreib einen " },
      { kind: "added", text: "kurzen " },
      { kind: "same", text: "Brief" },
    ]);
    expect(diffWords("Schreib einen kurzen Brief", "Schreib einen Brief")).toEqual([
      { kind: "same", text: "Schreib einen " },
      { kind: "removed", text: "kurzen " },
      { kind: "same", text: "Brief" },
    ]);
    expect(diffWords("Ton: locker", "Ton: förmlich")).toEqual([
      { kind: "same", text: "Ton: " },
      { kind: "removed", text: "locker" },
      { kind: "added", text: "förmlich" },
    ]);
  });

  it("zeigt je Block erst das Entfernte, dann das Eingefügte, ohne zwei gleiche Teile nebeneinander", () => {
    const parts = diffWords("a b c d e", "a x c y e");
    expect(parts).toEqual([
      { kind: "same", text: "a " },
      { kind: "removed", text: "b" },
      { kind: "added", text: "x" },
      { kind: "same", text: " c " },
      { kind: "removed", text: "d" },
      { kind: "added", text: "y" },
      { kind: "same", text: " e" },
    ]);
    for (let i = 1; i < parts.length; i += 1) expect(parts[i].kind).not.toBe(parts[i - 1].kind);
  });

  it("behält Leerraum und Zeilenumbrüche", () => {
    const before = "Zeile eins\n\n- Punkt  A\n- Punkt B\n";
    const after = "Zeile eins\n\n- Punkt  A\n- Punkt C\n- Punkt D\n";
    expect(rebuild(diffWords(before, after))).toEqual({ before, after });
  });

  it("baut beide Fassungen aus zufälligen Änderungen wieder auf", () => {
    const words = ["Prompt", "Ton", "kurz", "Leser", "Ziel", "\n", " ", "  ", "Format", "Beispiel"];
    const rand = lcg(42);
    const pick = () => words[Math.floor(rand() * words.length)];
    for (let run = 0; run < 200; run += 1) {
      const a = Array.from({ length: Math.floor(rand() * 40) }, pick);
      const b = a.filter(() => rand() > 0.2).flatMap((w) => (rand() > 0.85 ? [w, pick()] : [w]));
      const before = a.join(" ");
      const after = b.join(" ");
      expect(rebuild(diffWords(before, after)), `Lauf ${run}`).toEqual({ before, after });
    }
  });

  it("findet bei wenigen Änderungen in langen Texten nur diese", () => {
    const base = Array.from({ length: 6000 }, (_, i) => `Wort${i}`).join(" ");
    const after = base.replace("Wort3000", "Neu").replace("Wort10 ", "");
    const start = performance.now();
    const parts = diffWords(base, after);
    expect(performance.now() - start).toBeLessThan(500);
    expect(parts.filter((p) => p.kind !== "same").map((p) => p.text)).toEqual(["Wort10 ", "Wort3000", "Neu"]);
    expect(rebuild(parts)).toEqual({ before: base, after });
  });

  it("weicht bei sehr vielen Änderungen auf Zeilen aus und bleibt richtig", () => {
    const before = Array.from({ length: 300 }, (_, i) => `a${i} b${i} c${i}`).join("\n");
    const after = Array.from({ length: 300 }, (_, i) => (i % 2 ? `x${i} y${i} z${i}` : `a${i} b${i} c${i}`)).join("\n");
    const parts = diffWords(before, after, 50);
    expect(rebuild(parts)).toEqual({ before, after });
    // Auf Zeilen: unveränderte Zeilen bleiben gleich, statt dass alles neu wäre.
    expect(parts.find((p) => p.kind === "same")?.text).toContain("a0 b0 c0\n");
  });

  it("fällt ohne erlaubte Schritte auf einen Block zurück und behält gemeinsamen Anfang und Ende", () => {
    expect(diffWords("Ton: locker.", "Ton: förmlich.", 0)).toEqual([
      { kind: "same", text: "Ton: " },
      { kind: "removed", text: "locker" },
      { kind: "added", text: "förmlich" },
      { kind: "same", text: "." },
    ]);
  });

  it("zeigt ganz verschiedene Texte als alt entfernt und neu eingefügt, schnell", () => {
    const rand = lcg(7);
    const noise = (len: number) => Array.from({ length: len }, () => Math.floor(rand() * 1e9).toString(36)).join(" ");
    const before = noise(5000);
    const after = noise(5000);
    const start = performance.now();
    const parts = diffWords(before, after);
    expect(performance.now() - start).toBeLessThan(2000);
    expect(rebuild(parts)).toEqual({ before, after });
    expect(parts.filter((p) => p.kind === "removed")).toHaveLength(1);
    expect(parts.filter((p) => p.kind === "added")).toHaveLength(1);
  });
});
