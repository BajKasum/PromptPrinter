import { describe, expect, it } from "vitest";
import { assessPrompt, QUALITY_LINE_LIVE, type QualityCriterion } from "@/features/chat/lib/prompt-quality";
import { CORPUS, type CorpusEntry } from "@tests/support/prompt-corpus";

const present = (prompt: string): QualityCriterion[] =>
  (assessPrompt(prompt)?.items ?? []).filter((i) => i.present).map((i) => i.criterion);
const missing = (prompt: string): QualityCriterion[] =>
  (assessPrompt(prompt)?.items ?? []).filter((i) => !i.present).map((i) => i.criterion);

describe("Qualitätszeile: Kriterien je Aufgabe", () => {
  it("fragt bei einem Brief nach Leser, Ton, Länge und Grenzen", () => {
    const report = assessPrompt(CORPUS.find((e) => e.id === "text-vermieter")!.prompt);
    expect(report?.kind).toBe("text");
    expect(report?.items.map((i) => i.criterion)).toEqual(["reader", "tone", "length", "limits"]);
  });

  it("fragt bei einer Webseite nach Seiten, Daten, Anmeldung und Aussehen", () => {
    const report = assessPrompt(CORPUS.find((e) => e.id === "sw-verein")!.prompt);
    expect(report?.kind).toBe("software");
    expect(report?.items.map((i) => i.criterion)).toEqual(["screens", "data", "login", "look"]);
  });

  it("fragt bei einer Datenbank-Aufgabe nach System, Umfang, Ausgabe und Grenzen", () => {
    const report = assessPrompt(CORPUS.find((e) => e.id === "rev-datenbank")!.prompt);
    expect(report?.kind).toBe("review");
    expect(report?.items.map((i) => i.criterion)).toEqual(["system", "scope", "output", "limits"]);
  });

  it("nennt, was fehlt, und nennt es nicht, wenn es dasteht", () => {
    const prompt = CORPUS.find((e) => e.id === "text-bewerbung")!.prompt;
    expect(missing(prompt)).toEqual(["reader"]);
    expect(present(prompt)).toEqual(["tone", "length", "limits"]);
  });

  it("erkennt Wörter mit Umlaut am Anfang (Übersicht)", () => {
    const prompt =
      "Baue eine App für Hundetrainer, mit der sie Kunden und Termine verwalten. Es braucht eine Übersicht der Termine der Woche. Ein Login ist nicht nötig, die App läuft nur lokal auf einem Laptop.";
    expect(present(prompt)).toContain("screens");
  });
});

describe("Qualitätszeile: wann nichts erscheint", () => {
  it("zeigt bei kurzen Prompts nichts, sie gelten nicht als mangelhaft", () => {
    for (const id of ["text-rede-kurz", "sw-todo-kurz", "rev-verkaufszahlen-kurz", "sw-fotografie"]) {
      expect(assessPrompt(CORPUS.find((e) => e.id === id)!.prompt)).toBeNull();
    }
  });

  it("zeigt bei Skript, Formel, Bild und Plan nichts", () => {
    for (const id of ["other-skript", "other-formel", "other-bild", "other-lernplan"]) {
      expect(assessPrompt(CORPUS.find((e) => e.id === id)!.prompt)).toBeNull();
    }
  });

  it("zeigt bei einem Prompt in einer anderen Sprache nichts", () => {
    // Beide enthalten ein Wort, das die Aufgabenart treffen würde ("e-mail", "email"): nur die Sprachprüfung hält sie draussen.
    const fr =
      "Tu es un rédacteur expérimenté. Rédige un e-mail à mon propriétaire au sujet de la moisissure dans la salle de bain, avec un ton factuel et ferme, d'une demi-page, pour la direction de la gérance de l'immeuble.";
    const es =
      "Eres un redactor con experiencia. Escribe un email a mi casero sobre el moho en el baño, con un tono factual y firme, de media página, dirigido a la administración de la finca y sin citar leyes.";
    expect(assessPrompt(fr)).toBeNull();
    expect(assessPrompt(es)).toBeNull();
  });

  it("zeigt bei leerem Text und bei Text ohne erkennbare Aufgabe nichts", () => {
    expect(assessPrompt("")).toBeNull();
    expect(assessPrompt("Das ist ein langer Satz ohne Aufgabe, den niemand braucht, und er geht noch eine Weile weiter, weil er lang sein soll und nichts will.")).toBeNull();
  });
});

// Messung vom 2026-11-01 (Issue #243). Sie trägt die Zeile NICHT, deshalb ist QUALITY_LINE_LIVE aus. Die Zahlen
// stehen hier, damit der Test anschlägt, sobald jemand die Erkennung oder die Sammlung ändert: dann neu
// messen, im Issue nachtragen und erst danach über den Schalter entscheiden.
type Metrics = { kindRight: number; kindTotal: number; shown: number; present: number; presentMissed: number; absent: number; absentWrong: number };

function measure(entries: CorpusEntry[]): Metrics {
  const m: Metrics = { kindRight: 0, kindTotal: 0, shown: 0, present: 0, presentMissed: 0, absent: 0, absentWrong: 0 };
  for (const e of entries) {
    const expected = e.prompt.trim().split(/\s+/).length < 25 || e.kind === "other" ? null : e.kind;
    const got = assessPrompt(e.prompt);
    m.kindTotal++;
    if ((got?.kind ?? null) === expected) m.kindRight++;
    if (!got || got.kind !== expected) continue;
    m.shown++;
    for (const item of got.items) {
      const label = e.has[item.criterion] === true;
      if (label) {
        m.present++;
        if (!item.present) m.presentMissed++;
      } else {
        m.absent++;
        if (item.present) m.absentWrong++;
      }
    }
  }
  return m;
}

/** Die Hürde, vor der Messung festgelegt: Aufgabenart ≥ 90 %, zu Unrecht "fehlt" ≤ 10 %, zu Unrecht "enthalten" ≤ 10 %. */
function meetsBar(m: Metrics): boolean {
  return (
    m.kindRight / m.kindTotal >= 0.9 &&
    m.presentMissed / Math.max(1, m.present) <= 0.1 &&
    m.absentWrong / Math.max(1, m.absent) <= 0.1 &&
    m.absent >= 10
  );
}

describe("Qualitätszeile: Messung an der Sammlung (#243)", () => {
  const dev = measure(CORPUS.filter((e) => e.split === "dev"));
  const holdout = measure(CORPUS.filter((e) => e.split === "holdout"));

  it("hat die dokumentierten Zahlen", () => {
    expect(dev).toEqual({ kindRight: 17, kindTotal: 17, shown: 12, present: 41, presentMissed: 0, absent: 7, absentWrong: 0 });
    expect(holdout).toEqual({ kindRight: 13, kindTotal: 13, shown: 10, present: 37, presentMissed: 0, absent: 3, absentWrong: 1 });
  });

  it("trägt die Zeile nicht: zu wenige 'fehlt'-Fälle und zu Unrecht 'enthalten' an der Gegenhälfte", () => {
    expect(meetsBar(holdout)).toBe(false);
  });

  it("die Zeile ist nur an, wenn die Hürde an der Gegenhälfte erfüllt ist", () => {
    if (QUALITY_LINE_LIVE) expect(meetsBar(holdout)).toBe(true);
    expect(QUALITY_LINE_LIVE).toBe(false);
  });
});
