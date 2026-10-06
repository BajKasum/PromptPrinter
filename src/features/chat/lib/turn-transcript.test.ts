import { describe, expect, it } from "vitest";
import {
  CHAT_HISTORY_LIMIT,
  clampStoredReplies,
  collapseConsecutiveRoles,
  normalizeTranscript,
  trimHistory,
} from "./turn-transcript";
import { MAX_ASSISTANT_MESSAGE_CHARS, MAX_TRANSCRIPT_MESSAGES } from "@/shared/lib/chat-limits";

// Die reinen Funktionen, die ein Chat-Zug auf dem Verlauf ausführt (aus api/chat/route.ts herausgelöst,
// Betriebs-Audit M7). route.test.ts prüft sie über POST; hier stehen die Randfälle direkt.

const turns = (n: number, firstRole: "user" | "assistant" = "user") =>
  Array.from({ length: n }, (_, i) => ({
    role: ((i % 2 === 0) === (firstRole === "user") ? "user" : "assistant") as "user" | "assistant",
    content: `m${i}`,
  }));

describe("trimHistory", () => {
  it("lässt einen kurzen Verlauf, wie er ist (dieselbe Liste)", () => {
    const short = turns(CHAT_HISTORY_LIMIT);
    expect(trimHistory(short)).toBe(short);
  });

  it("schneidet auf die letzten Nachrichten und fängt NIE mit einer Assistenten-Antwort an (K-3)", () => {
    // 13 Nachrichten ab "user": das Fenster der letzten 12 begänne mit "assistant".
    const long = turns(CHAT_HISTORY_LIMIT + 1);
    const trimmed = trimHistory(long);
    expect(trimmed[0].role).toBe("user");
    expect(trimmed.at(-1)).toEqual(long.at(-1));
    expect(trimmed.length).toBeLessThanOrEqual(CHAT_HISTORY_LIMIT);
  });

  it("lässt ein Fenster, das schon mit 'user' beginnt, unberührt", () => {
    // 14 Nachrichten ab "user": die letzten 12 beginnen mit "user".
    const long = turns(CHAT_HISTORY_LIMIT + 2);
    expect(trimHistory(long)).toHaveLength(CHAT_HISTORY_LIMIT);
  });

  it("schneidet nicht auf leer, wenn es im Fenster gar keine Nutzer-Nachricht gibt", () => {
    const onlyAssistant = Array.from({ length: CHAT_HISTORY_LIMIT + 3 }, (_, i) => ({
      role: "assistant" as const,
      content: `a${i}`,
    }));
    expect(trimHistory(onlyAssistant)).toHaveLength(CHAT_HISTORY_LIMIT);
  });
});

describe("collapseConsecutiveRoles", () => {
  it("lässt abwechselnde Rollen unberührt", () => {
    const alternating = [
      { role: "user" as const, content: "a" },
      { role: "assistant" as const, content: "b" },
      { role: "user" as const, content: "c" },
    ];
    expect(collapseConsecutiveRoles(alternating)).toEqual(alternating);
  });

  it("verschmilzt gleiche Rollen hintereinander mit einer Leerzeile", () => {
    const merged = collapseConsecutiveRoles([
      { role: "user", content: "a" },
      { role: "user", content: "b" },
      { role: "assistant", content: "c" },
    ]);
    expect(merged).toEqual([
      { role: "user", content: "a\n\nb" },
      { role: "assistant", content: "c" },
    ]);
  });

  it("führt beim Verschmelzen die Bilder beider Nachrichten mit, sonst verschwänden sie", () => {
    const one = { mediaType: "image/png", base64: "AA" };
    const two = { mediaType: "image/jpeg", base64: "BB" };
    const merged = collapseConsecutiveRoles([
      { role: "user", content: "a", images: [one] },
      { role: "user", content: "b", images: [two] },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].images).toEqual([one, two]);
  });

  it("setzt kein leeres images-Feld, wenn keine Nachricht Bilder trägt", () => {
    const merged = collapseConsecutiveRoles([
      { role: "user", content: "a" },
      { role: "user", content: "b" },
    ]);
    expect("images" in merged[0]).toBe(false);
  });

  it("verträgt eine leere Liste", () => {
    expect(collapseConsecutiveRoles([])).toEqual([]);
  });
});

describe("normalizeTranscript", () => {
  it("reicht alles durch, was kein Objekt mit einer Nachrichtenliste ist", () => {
    for (const value of [null, undefined, 42, "x", [], { messages: "kein array" }, {}]) {
      expect(normalizeTranscript(value)).toBe(value);
    }
  });

  it("lässt eine Liste bis zur Grenze unverändert (dasselbe Objekt)", () => {
    const body = { messages: turns(MAX_TRANSCRIPT_MESSAGES) };
    expect(normalizeTranscript(body)).toBe(body);
  });

  it("kürzt eine längere Liste auf die NEUESTEN Nachrichten und behält die übrigen Felder", () => {
    const body = { conversationId: "c", messages: turns(MAX_TRANSCRIPT_MESSAGES + 5) };
    const out = normalizeTranscript(body) as typeof body;
    expect(out.messages).toHaveLength(MAX_TRANSCRIPT_MESSAGES);
    expect(out.messages.at(-1)).toEqual(body.messages.at(-1));
    expect(out.conversationId).toBe("c");
  });
});

describe("clampStoredReplies", () => {
  it("kürzt nur Assistenten-Antworten über der Grenze", () => {
    const body = {
      messages: [
        { role: "user", content: "u".repeat(MAX_ASSISTANT_MESSAGE_CHARS + 10) },
        { role: "assistant", content: "a".repeat(MAX_ASSISTANT_MESSAGE_CHARS + 10) },
      ],
    };
    const out = clampStoredReplies(body) as typeof body;
    expect(out.messages[0].content).toHaveLength(MAX_ASSISTANT_MESSAGE_CHARS + 10);
    expect(out.messages[1].content.length).toBeLessThanOrEqual(MAX_ASSISTANT_MESSAGE_CHARS);
  });

  it("gibt dasselbe Objekt zurück, wenn nichts zu kürzen war", () => {
    const body = { messages: [{ role: "assistant", content: "kurz" }] };
    expect(clampStoredReplies(body)).toBe(body);
  });

  it("reicht Unbrauchbares durch, statt zu werfen", () => {
    for (const value of [null, 1, "x", [], {}, { messages: "x" }, { messages: [null, 3, "x"] }]) {
      expect(() => clampStoredReplies(value)).not.toThrow();
    }
  });
});
