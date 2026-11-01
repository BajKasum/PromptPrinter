import { describe, expect, it } from "vitest";
import { chatStreamSchemas, parseChatStreamEvent } from "./chat-stream";

// Der Vertrag des Antwort-Stroms (#210). Dass reply-stream.ts nur Nutzlasten dieser Form sendet, hält der
// Typ von `send` (server/http/sse-writer.ts) und der Vertragstest in api/chat/route.exits.test.ts fest;
// hier steht, was der Leser aus einem Rahmen macht.

const parse = (event: string, data: unknown) => parseChatStreamEvent(event, JSON.stringify(data));

describe("parseChatStreamEvent", () => {
  it("liest jedes der fünf Ereignisse mit seiner Nutzlast", () => {
    expect(parse("meta", { conversationId: "c", userMessageId: "u" })).toEqual({
      kind: "event",
      value: { event: "meta", data: { conversationId: "c", userMessageId: "u" } },
    });
    expect(parse("status", { phase: "retrying", attempt: 2, maxAttempts: 3 })).toMatchObject({
      kind: "event",
      value: { event: "status", data: { phase: "retrying", attempt: 2, maxAttempts: 3 } },
    });
    expect(parse("delta", { text: "Hallo" })).toMatchObject({ value: { event: "delta", data: { text: "Hallo" } } });
    expect(parse("done", { mode: "generated", conversationId: "c", assistantMessageId: "a" })).toMatchObject({
      value: { event: "done", data: { assistantMessageId: "a" } },
    });
    expect(parse("error", { detail: "kaputt" })).toMatchObject({ value: { event: "error", data: { detail: "kaputt" } } });
  });

  it("ein unbekanntes Ereignis ist `unknown`, auch mit kaputtem Inhalt (ältere Clients ignorieren es)", () => {
    expect(parseChatStreamEvent("zukunft", "{kein json")).toEqual({ kind: "unknown", event: "zukunft" });
    expect(parseChatStreamEvent("toString", "{}")).toEqual({ kind: "unknown", event: "toString" });
  });

  it("unbekannte Felder in einem bekannten Ereignis stören nicht und werden nicht weitergereicht", () => {
    const parsed = parse("delta", { text: "x", neu: 1 });
    expect(parsed).toEqual({ kind: "event", value: { event: "delta", data: { text: "x" } } });
  });

  it("eine unbekannte Phase ist gültig: ein älterer Client bricht den Zug deshalb nicht ab", () => {
    expect(parse("status", { phase: "etwas-neues" })).toMatchObject({ kind: "event" });
  });

  it("der Leser verlässt sich nur auf das Nötige: done und meta ohne Kontextfelder sind gültig", () => {
    expect(parse("done", {})).toMatchObject({ kind: "event" });
    expect(parse("meta", {})).toMatchObject({ kind: "event" });
  });

  it.each([
    ["kein JSON", "delta", "{kaputt"],
    ["kein Objekt", "delta", "null"],
    ["Pflichtfeld fehlt (delta.text)", "delta", "{}"],
    ["falscher Typ (delta.text)", "delta", '{"text":5}'],
    ["Pflichtfeld fehlt (error.detail)", "error", "{}"],
    ["Pflichtfeld fehlt (status.phase)", "status", '{"attempt":1}'],
    ["falscher Typ (done.persistError)", "done", '{"persistError":true}'],
    ["falscher Typ (meta.conversationId)", "meta", '{"conversationId":7}'],
  ])("%s: ein Protokollfehler", (_name, event, data) => {
    expect(parseChatStreamEvent(event, data)).toEqual({ kind: "invalid", event });
  });
});

describe("chatStreamSchemas (was der Server sendet)", () => {
  it("done verlangt Modus und Konversation, assistantMessageId und persistError sind optional", () => {
    const done = chatStreamSchemas.done;
    expect(done.safeParse({ mode: "generated", conversationId: "c" }).success).toBe(true);
    expect(done.safeParse({ mode: "stub", conversationId: "c", persistError: "persist_failed" }).success).toBe(true);
    expect(done.safeParse({ conversationId: "c" }).success).toBe(false);
    expect(done.safeParse({ mode: "andere", conversationId: "c" }).success).toBe(false);
  });

  it("status verlangt Versuch und Obergrenze, meta die Konversation", () => {
    expect(chatStreamSchemas.status.safeParse({ phase: "retrying" }).success).toBe(false);
    expect(chatStreamSchemas.meta.safeParse({}).success).toBe(false);
  });
});
