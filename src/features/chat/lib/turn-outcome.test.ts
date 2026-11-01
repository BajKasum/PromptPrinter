import { describe, expect, it } from "vitest";
import { StreamProtocolError, type Msg } from "@/features/chat/lib/chat-wire";
import { MAX_TRANSCRIPT_MESSAGES } from "@/shared/lib/chat-limits";
import { buildChatBody, classifyTurnError, readHttpFailure, TurnHttpError } from "./turn-outcome";

// Die Einordnung eines gescheiterten Zugs und die Anfrage, ohne DOM (#212). Dass die Oberfläche daraus das
// Richtige zeigt, halten chat.test.tsx und chat.turn.test.tsx fest.

const abort = () => new DOMException("aborted", "AbortError");

describe("classifyTurnError", () => {
  it("der Abbruch des Nutzers ist kein Fehler: der bisherige Text bleibt stehen", () => {
    expect(classifyTurnError(abort(), "Halb", undefined)).toEqual({ kind: "stopped" });
    expect(classifyTurnError(abort(), "", undefined)).toEqual({ kind: "stopped" });
  });

  it("Neu-Erzeugen, gestoppt bevor ein Wort kam: die alte Antwort bleibt (#129)", () => {
    expect(classifyTurnError(abort(), "", "alt-1")).toEqual({ kind: "stoppedBeforeFirstWord" });
    expect(classifyTurnError(abort(), "  \n", "alt-1")).toEqual({ kind: "stoppedBeforeFirstWord" });
  });

  it("Neu-Erzeugen mit Teiltext zählt als normaler Stopp", () => {
    expect(classifyTurnError(abort(), "Neu angefangen", "alt-1")).toEqual({ kind: "stopped" });
  });

  it("eine von selbst gerissene Verbindung nach dem ersten Wort ist ein Abbruch der Verbindung (E-2)", () => {
    expect(classifyTurnError(new TypeError("Failed to fetch"), "Halb", undefined)).toEqual({
      kind: "connectionDropped",
    });
  });

  it("ein Fehler, den die Route selbst meldet, bleibt ein Fehler, auch mit Teiltext", () => {
    const error = new StreamProtocolError("Anbieter offline");
    expect(classifyTurnError(error, "Halb", undefined)).toEqual({
      kind: "failed",
      failure: null,
      retryAfter: null,
      error,
    });
  });

  it("derselbe Verbindungsfehler ohne Text ist ein Fehler", () => {
    const error = new TypeError("Failed to fetch");
    expect(classifyTurnError(error, "", undefined)).toMatchObject({ kind: "failed", error });
  });

  it("nur Leerraum zählt nicht als angekommener Text", () => {
    expect(classifyTurnError(new TypeError("x"), " \n ", undefined)).toMatchObject({ kind: "failed" });
  });

  it("eine abgelehnte Anfrage trägt Art und Wartezeit der Route weiter", () => {
    const error = new TurnHttpError("Zu viele", 42, "byokRequired");
    expect(classifyTurnError(error, "", undefined)).toEqual({
      kind: "failed",
      failure: "byokRequired",
      retryAfter: 42,
      error,
    });
  });

  it("etwas, das kein Error ist, wird nicht verschluckt", () => {
    expect(classifyTurnError("komisch", "", undefined)).toEqual({
      kind: "failed",
      failure: null,
      retryAfter: null,
      error: "komisch",
    });
  });
});

describe("readHttpFailure", () => {
  const response = (body: unknown, ok = false) =>
    ({ ok, json: async () => body }) as unknown as Response;

  it("liest Meldung, Art und Wartezeit aus der Problem-Antwort", async () => {
    const error = await readHttpFailure(response({ detail: "Limit", kind: "chatMessages", retryAfter: 30 }), "Fallback");
    expect(error).toBeInstanceOf(TurnHttpError);
    expect(error).toMatchObject({ message: "Limit", kind: "chatMessages", retryAfter: 30 });
  });

  it("ohne lesbaren Body bleibt der Fallbacktext, ohne Art und Wartezeit", async () => {
    const res = { ok: false, json: async () => Promise.reject(new SyntaxError("x")) } as unknown as Response;
    expect(await readHttpFailure(res, "Chat fehlgeschlagen")).toMatchObject({
      message: "Chat fehlgeschlagen",
      kind: null,
      retryAfter: null,
    });
  });

  it("Art und Wartezeit nur mit dem richtigen Typ", async () => {
    const error = await readHttpFailure(response({ kind: 7, retryAfter: "30" }), "F");
    expect(error).toMatchObject({ kind: null, retryAfter: null });
  });
});

describe("buildChatBody", () => {
  const msg = (i: number): Msg => ({ id: `id-${i}`, role: i % 2 === 0 ? "user" : "assistant", content: `m${i}` });

  it("schickt höchstens die neuesten Nachrichten", () => {
    const next = Array.from({ length: MAX_TRANSCRIPT_MESSAGES + 5 }, (_, i) => msg(i));
    const body = buildChatBody({ next, conversationId: "c", projectId: "p" });
    expect(body.messages).toHaveLength(MAX_TRANSCRIPT_MESSAGES);
    expect(body.messages.at(-1)?.id).toBe(next.at(-1)?.id);
    expect(body).toMatchObject({ conversationId: "c", projectId: "p" });
  });

  it("die optionalen Felder fehlen, wenn sie nicht gesetzt sind", () => {
    const body = buildChatBody({ next: [msg(0)], conversationId: undefined, projectId: undefined });
    expect(Object.keys(body).sort()).toEqual(["conversationId", "messages", "projectId"]);
    expect(JSON.parse(JSON.stringify(body))).toEqual({ messages: [{ id: "id-0", role: "user", content: "m0" }] });
  });

  it("Neu-Erzeugen, Ersetzen und geerbte Anhänge reisen mit", () => {
    const body = buildChatBody({
      next: [msg(0)],
      conversationId: "c",
      projectId: undefined,
      replaceMessageId: "alt",
      supersededMessageIds: ["a", "b"],
      attach: { inheritFrom: "vorher" },
    });
    expect(body).toMatchObject({
      replaceMessageId: "alt",
      supersededMessageIds: ["a", "b"],
      inheritAttachmentsFrom: "vorher",
    });
    expect(buildChatBody({ next: [msg(0)], conversationId: "c", projectId: undefined, supersededMessageIds: [] })).not.toHaveProperty(
      "supersededMessageIds"
    );
  });

  it("Dateien reisen nur an der neuesten Nachricht", () => {
    const uploads = [{ name: "a.png", mediaType: "image/png", data: "QQ==" }] as never;
    const body = buildChatBody({ next: [msg(0), msg(1), msg(2)], conversationId: "c", projectId: undefined, attach: { uploads } });
    expect(body.messages.slice(0, -1).every((m) => !("attachments" in m))).toBe(true);
    expect(body.messages.at(-1)).toHaveProperty("attachments");
  });
});
