import { describe, expect, it } from "vitest";
import { MAX_USER_MESSAGE_CHARS } from "@/shared/lib/chat-limits";
import { isSavedPromptId, startFromCaret, startFromHref, startFromText } from "@/shared/lib/start-from-prompt";

const ID = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";

describe("start-from-prompt", () => {
  it("erkennt nur UUIDs als ID eines gespeicherten Prompts", () => {
    expect(isSavedPromptId(ID)).toBe(true);
    expect(isSavedPromptId(ID.toUpperCase())).toBe(true);
    for (const v of [undefined, null, 42, "", "abc", `${ID}x`, ` ${ID}`, [ID]]) expect(isSavedPromptId(v)).toBe(false);
  });

  it("setzt die Zeile für die Änderung über den Prompt, mit Leerzeichen für den Cursor", () => {
    expect(startFromText("Pass diesen Prompt an:", "  Schreib eine Einladung.\n")).toBe(
      "Pass diesen Prompt an: \n\nSchreib eine Einladung."
    );
  });

  it("gibt null, wenn der Text nicht in eine Nachricht passt oder leer ist", () => {
    const prefix = "Pass diesen Prompt an:";
    const room = MAX_USER_MESSAGE_CHARS - (prefix.length + 3);
    expect(startFromText(prefix, "x".repeat(room))).toHaveLength(MAX_USER_MESSAGE_CHARS);
    expect(startFromText(prefix, "x".repeat(room + 1))).toBeNull();
    expect(startFromText(prefix, "   ")).toBeNull();
  });

  it("stellt den Cursor ans Ende der ersten Zeile", () => {
    const text = startFromText("Pass diesen Prompt an:", "Prompt")!;
    expect(text.slice(0, startFromCaret(text))).toBe("Pass diesen Prompt an: ");
    expect(startFromCaret("eine Zeile")).toBe("eine Zeile".length);
  });

  it("öffnet den neuen Chat im Projekt des Prompts, sonst global, und trägt nur die ID in der Adresse", () => {
    expect(startFromHref(ID, "proj-1")).toBe(`/projects/proj-1/chats/new?from=${ID}`);
    expect(startFromHref(ID, null)).toBe(`/chats/new?from=${ID}`);
    expect(startFromHref(ID)).toBe(`/chats/new?from=${ID}`);
  });
});
