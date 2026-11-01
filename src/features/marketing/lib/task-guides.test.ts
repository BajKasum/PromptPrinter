import { describe, expect, it } from "vitest";
import { TASK_GUIDES, TASK_GUIDES_UPDATED, taskGuideBySlug, taskGuideHref } from "./task-guides";

describe("Aufgabenseiten", () => {
  it("vergibt jeden Slug nur einmal, in einer Form, die als Adresse taugt", () => {
    const slugs = TASK_GUIDES.map((guide) => guide.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("findet eine Seite über ihren Slug und baut ihre Adresse unter /aufgaben", () => {
    const first = TASK_GUIDES[0];

    expect(taskGuideBySlug(first.slug)).toBe(first);
    expect(taskGuideBySlug("gibt-es-nicht")).toBeUndefined();
    expect(taskGuideHref(first.slug)).toBe(`/aufgaben/${first.slug}`);
  });

  it("deckt die fünf Aufgaben ab, die der Autor festgelegt hat", () => {
    expect(TASK_GUIDES.map((guide) => guide.label)).toEqual([
      "Brief",
      "Webseite",
      "Datenbank",
      "Sicherheitsprüfung",
      "Lernplan",
    ]);
  });

  it("stellt die Seite als Frage und hält den Titel kurz genug für die Trefferliste", () => {
    for (const guide of TASK_GUIDES) {
      expect(guide.question, guide.slug).toMatch(/\?$/);
      expect(guide.question.length, guide.slug).toBeLessThanOrEqual(65);
      expect(guide.summary.length, guide.slug).toBeLessThanOrEqual(190);
    }
  });

  it("nennt je Seite mindestens vier Angaben, jede als Frage mit Begründung", () => {
    for (const guide of TASK_GUIDES) {
      expect(guide.needs.length, guide.slug).toBeGreaterThanOrEqual(4);
      for (const need of guide.needs) {
        expect(need.question, guide.slug).toMatch(/\?$/);
        expect(need.why.trim(), need.question).not.toBe("");
      }
    }
  });

  // Regel 3 aus task-guides.ts: jede Seite sagt, wann man das nicht braucht.
  it("sagt auf jeder Seite, wann man das nicht braucht", () => {
    for (const guide of TASK_GUIDES) {
      expect(guide.notNeeded.length, guide.slug).toBeGreaterThan(0);
      for (const paragraph of guide.notNeeded) expect(paragraph.trim(), guide.slug).not.toBe("");
    }
  });

  // Regel 2: das Beispiel hält die Regeln ein, nach denen Finn fragt (server/system-prompt.ts).
  describe("Beispiel", () => {
    it("fragt gebündelt und mit höchstens vier Fragen", () => {
      for (const guide of TASK_GUIDES) {
        const questions = guide.example.question.match(/\?/g) ?? [];
        expect(questions.length, guide.slug).toBeGreaterThan(0);
        expect(questions.length, guide.slug).toBeLessThanOrEqual(4);
      }
    });

    it("fragt nie nach Namen, Adressen oder anderen persönlichen Daten", () => {
      for (const guide of TASK_GUIDES) {
        const asked = guide.example.question.split("?").filter((part) => part.includes(" "));
        for (const part of asked) {
          expect(part, guide.slug).not.toMatch(/\b(dein|deine|Ihr|Ihre)\s+(Name|Adresse|E-Mail|Telefon)/i);
        }
      }
    });

    it("ist an eine KI gerichtet und gibt keine fertige Antwort vor", () => {
      for (const guide of TASK_GUIDES) {
        expect(guide.example.prompt, guide.slug).toMatch(/^Du bist /);
        expect(guide.example.prompt.length, guide.slug).toBeGreaterThan(300);
        expect(guide.example.prompt, guide.slug).not.toMatch(/```/);
      }
    });

    // Persönliche Daten stehen nie als Angabe im Prompt, sondern als Platzhalter (Regel 4).
    it("setzt persönliche Angaben im Brief als Platzhalter in eckigen Klammern", () => {
      const prompt = taskGuideBySlug("brief-schreiben-lassen")!.example.prompt;
      for (const slot of ["[mein Name]", "[meine Adresse]", "[Mitgliedsnummer]"]) expect(prompt).toContain(slot);
    });

    it("nennt keine Gesetze, Paragrafen oder Behörden", () => {
      for (const guide of TASK_GUIDES) {
        expect(guide.example.prompt, guide.slug).not.toMatch(/§|\bArt\.\s?\d|\bOR\b|\bBGB\b|\bDSGVO\b/);
      }
    });
  });

  // Regel 4 und die Markenregeln: keine Bau-Tools, keine Zielgruppe "Vibe-Coder", kein Preis, keine Messwerte.
  it("nennt keine Bau-Tools, keinen Preis und keine Messwerte oder Stimmen", () => {
    const text = JSON.stringify(TASK_GUIDES);
    expect(text).not.toMatch(/Lovable|Cursor|\bv0\b|Bolt|Vibe/i);
    expect(text).not.toMatch(/€|\bEUR\b|\bCHF\b|\bUSD\b|\bFr\.\s?\d/);
    expect(text).not.toMatch(/\d+\s?%|\d+ von \d+ |Kundenstimme|Bewertung|Sterne|getestet mit/i);
  });

  it("verlinkt nur auf interne Seiten", () => {
    for (const guide of TASK_GUIDES) {
      expect(guide.related.length, guide.slug).toBeGreaterThan(0);
      for (const link of guide.related) expect(link.href).toMatch(/^\/[a-z]/);
    }
  });

  it("trägt gültige Daten, die nicht in der Zukunft liegen", () => {
    const today = new Date().toISOString().slice(0, 10);

    expect(TASK_GUIDES_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(TASK_GUIDES_UPDATED <= today).toBe(true);
    for (const guide of TASK_GUIDES) {
      expect(guide.published, guide.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(guide.published <= TASK_GUIDES_UPDATED, guide.slug).toBe(true);
    }
  });
});
