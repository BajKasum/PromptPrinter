import { describe, expect, it } from "vitest";
import { hideChoicesWhileStreaming, parseChoices, splitChoices } from "@/features/chat/lib/choices";
import { extractPrompt } from "@/shared/lib/saved-prompts";
import { CHOICES_RULE } from "@/server/system-prompt";

const block = (lines: string, close = "\n") => `\`\`\`choices\n${lines}${close}\`\`\``;

describe("splitChoices: Antworten mit Vorschlägen", () => {
  // Wie viele Fragen mit wie vielen Optionen, und was vom Text übrig bleibt.
  const cases: [string, string, number[], string][] = [
    ["drei Fragen", `Wie soll der Brief klingen?\n\n${block("Ton? | sachlich | freundlich | locker\nLänge? | kurz | ausführlich\nAn wen? | Vermieter | Hausverwaltung")}`, [3, 2, 2], "Wie soll der Brief klingen?"],
    ["eine Zeile", `Wie lang?\n\n${block("Länge? | kurz | lang")}`, [2], "Wie lang?"],
    ["mit Aufzählungszeichen", `Frage\n\n${block("- Ton? | ernst | locker\n1. Länge? | kurz | lang")}`, [2, 2], "Frage"],
    ["mit zusätzlichen Leerzeichen", `Frage\n\n${block("  Ton?   |  ernst  |   locker   ")}`, [2], "Frage"],
    ["mit Windows-Zeilenenden", `Frage\r\n\r\n\`\`\`choices\r\nTon? | ernst | locker\r\n\`\`\``, [2], "Frage"],
    ["mit Zaun auf der Inhaltszeile", `Frage\n\n\`\`\`choices\nTon? | ernst | locker\`\`\``, [2], "Frage"],
    ["mit Text danach", `Frage\n\n${block("Ton? | ernst | locker")}\n\nSag mir einfach Bescheid.`, [2], "Frage\n\nSag mir einfach Bescheid."],
    ["auf Englisch", `What tone?\n\n${block("Tone? | formal | friendly | casual")}`, [3], "What tone?"],
    ["mit vier Optionen", `Frage\n\n${block("Ton? | a | b | c | d")}`, [4], "Frage"],
    ["mit Umlauten und Sonderzeichen", `Frage\n\n${block("Größe? | Mäßig & klein | <b>riesig</b>")}`, [2], "Frage"],
    ["mit mehr als vier Zeilen (die ersten vier zählen)", `Frage\n\n${block("a? | 1 | 2\nb? | 1 | 2\nc? | 1 | 2\nd? | 1 | 2\ne? | 1 | 2")}`, [2, 2, 2, 2], "Frage"],
    ["mit einer gültigen und einer ungültigen Zeile", `Frage\n\n${block("Ton? | ernst | locker\nkaputte Zeile ohne Striche")}`, [2], "Frage"],
  ];

  it.each(cases)("liest %s", (_name, content, optionCounts, text) => {
    const result = splitChoices(content);
    expect(result.choices?.map((q) => q.options.length)).toEqual(optionCounts);
    expect(result.text).toBe(text);
    expect(result.text).not.toContain("choices");
  });

  it("liest die Optionen als einfachen Text", () => {
    const result = splitChoices(`Frage\n\n${block("Größe? | Mäßig & klein | <b>riesig</b>")}`);
    expect(result.choices?.[0]).toEqual({ question: "Größe?", options: ["Mäßig & klein", "<b>riesig</b>"] });
  });

  // Alles, was nicht streng passt, bleibt wie heute: kein Vorschlag, der Text unverändert.
  const broken: [string, string][] = [
    ["kein Block", "Wie soll der Brief klingen, und für wen ist er?"],
    ["Block mit anderer Sprache", `Frage\n\n\`\`\`text\nTon? | ernst | locker\n\`\`\``],
    ["Tippfehler im Namen", `Frage\n\n\`\`\`choice\nTon? | ernst | locker\n\`\`\``],
    ["eine Option je Zeile", `Frage\n\n${block("Ton? | ernst")}`],
    ["fünf Optionen", `Frage\n\n${block("Ton? | a | b | c | d | e")}`],
    ["zu lange Option", `Frage\n\n${block(`Ton? | ernst | ${"x".repeat(61)}`)}`],
    ["leere Option", `Frage\n\n${block("Ton? | ernst |  | locker")}`],
    ["leerer Block", `Frage\n\n${block("")}`],
    ["zu lange Frage", `Frage\n\n${block(`${"y".repeat(121)} | a | b`)}`],
    ["Steuerzeichen", `Frage\n\n${block("Ton? | ernst | lo\u0007cker")}`],
    ["offener Zaun", "Frage\n\n```choices\nTon? | ernst | locker"],
    ["ohne Striche", `Frage\n\n${block("Welcher Ton? sachlich oder locker")}`],
    ["nur Striche", `Frage\n\n${block("| | |")}`],
  ];

  it.each(broken)("lässt bei '%s' alles wie es ist", (_name, content) => {
    expect(splitChoices(content)).toEqual({ text: content, choices: null });
  });

  it("nimmt den letzten Block, wenn mehrere da sind", () => {
    const content = `A\n\n${block("Alt? | x | y")}\n\nB\n\n${block("Neu? | p | q")}`;
    expect(splitChoices(content).choices?.[0].question).toBe("Neu?");
  });
});

describe("parseChoices", () => {
  it("liest die Form, die der Absatz im Systemprompt beschreibt", () => {
    expect(CHOICES_RULE).toContain("question | option | option | option");
    expect(parseChoices("question | option | option | option")).toEqual([
      { question: "question", options: ["option", "option", "option"] },
    ]);
  });

  it("begrenzt auf vier Fragen", () => {
    const lines = Array.from({ length: 9 }, (_, i) => `f${i}? | a | b`).join("\n");
    expect(parseChoices(lines)).toHaveLength(4);
  });
});

describe("hideChoicesWhileStreaming", () => {
  it("blendet einen fertigen Block aus", () => {
    expect(hideChoicesWhileStreaming(`Frage\n\n${block("Ton? | a | b")}`)).toBe("Frage");
  });

  it("blendet einen noch offenen Block am Ende aus", () => {
    expect(hideChoicesWhileStreaming("Frage\n\n```choices\nTon? | a | b")).toBe("Frage");
    expect(hideChoicesWhileStreaming("Frage\n\n```choices")).toBe("Frage");
  });

  it("lässt einen vollständigen, aber unbrauchbaren Block samt dem Text danach stehen", () => {
    const content = `Frage\n\n${block("Ton? | nur eine")}\n\nund noch ein Satz`;
    expect(hideChoicesWhileStreaming(content)).toBe(content);
  });

  it("lässt Antworten ohne Block unverändert", () => {
    expect(hideChoicesWhileStreaming("Nur ein Satz.")).toBe("Nur ein Satz.");
    expect(hideChoicesWhileStreaming("```text\nPrompt\n```")).toBe("```text\nPrompt\n```");
  });
});

describe("extractPrompt: der Vorschlags-Block ist kein Prompt", () => {
  it("findet in einer Rückfrage mit Vorschlägen keinen Prompt", () => {
    expect(extractPrompt(`Frage\n\n${block("Ton? | ernst | locker")}`)).toBeNull();
  });

  it("nimmt den Prompt-Block, auch wenn ein längerer Vorschlags-Block danebensteht", () => {
    const content = `${block("Welche Länge soll der Text haben, wenn er fertig ist? | kurz | ausführlich")}\n\n\`\`\`text\nKurzer Prompt\n\`\`\``;
    expect(extractPrompt(content)).toBe("Kurzer Prompt");
  });
});
