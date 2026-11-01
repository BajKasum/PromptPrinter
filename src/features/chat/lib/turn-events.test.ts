import { describe, expect, it, vi } from "vitest";
import { StreamProtocolError } from "@/features/chat/lib/chat-wire";
import type { ChatStreamEvent } from "@/shared/lib/chat-stream";
import { createTurnEventHandler, type TurnEventDeps } from "./turn-events";
import type { TurnAction } from "./turn-state";

// Was die Ereignisse des Stroms im Zustand eines Zugs bewirken, ohne DOM (#212). Die Oberfläche darüber
// halten chat.test.tsx und chat.turn.test.tsx fest.

function setup(overrides: Partial<TurnEventDeps> = {}) {
  const actions: TurnAction[] = [];
  const router = { refresh: vi.fn(), replace: vi.fn() };
  const deps: TurnEventDeps = {
    dispatch: (a) => actions.push(a),
    router,
    mounted: { current: true },
    pendingAssistantId: { current: null },
    conversationId: undefined,
    initialConversationId: undefined,
    projectId: undefined,
    optimisticUserMessageId: "opt-1",
    persistFailedMessage: "nicht gespeichert",
    ...overrides,
  };
  const handler = createTurnEventHandler(deps);
  return { handler, actions, router, deps };
}

const ev = <E extends ChatStreamEvent["event"]>(event: E, data: Extract<ChatStreamEvent, { event: E }>["data"]) =>
  ({ event, data }) as ChatStreamEvent;

describe("meta", () => {
  it("übernimmt die Konversation und tauscht die optimistische Frage gegen ihre Zeilen-ID", () => {
    const { handler, actions, router } = setup();
    handler.handle(ev("meta", { conversationId: "c1", userMessageId: "u1" }));
    expect(actions).toEqual([
      { type: "conversationAdopted", id: "c1" },
      { type: "userMessageIdReplaced", from: "opt-1", to: "u1" },
    ]);
    // Neuer Chat: Seitenleiste und Liste lernen die Konversation. Navigiert wird NICHT (K-1).
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("beim Neu-Erzeugen gibt es keine optimistische Frage zu tauschen", () => {
    const { handler, actions } = setup({ optimisticUserMessageId: null });
    handler.handle(ev("meta", { conversationId: "c1", userMessageId: "u1" }));
    expect(actions).toEqual([{ type: "conversationAdopted", id: "c1" }]);
  });

  it("in einem bestehenden Chat wird nicht neu geladen", () => {
    const { handler, router } = setup({ conversationId: "c1", initialConversationId: "c1" });
    handler.handle(ev("meta", { conversationId: "c1" }));
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("status und delta", () => {
  it("die Phase retrying schaltet den Hinweis ein, jede andere nicht", () => {
    const { handler, actions } = setup();
    handler.handle(ev("status", { phase: "retrying", attempt: 2, maxAttempts: 3 }));
    handler.handle(ev("status", { phase: "etwas-neues" }));
    expect(actions).toEqual([{ type: "retrying" }]);
  });

  it("sammelt den Text und meldet jedes Mal den ganzen bisherigen", () => {
    const { handler, actions } = setup();
    handler.handle(ev("delta", { text: "Hal" }));
    handler.handle(ev("delta", { text: "lo" }));
    expect(actions).toEqual([
      { type: "delta", text: "Hal" },
      { type: "delta", text: "Hallo" },
    ]);
    expect(handler.text()).toBe("Hallo");
  });
});

describe("error", () => {
  it("wirft den Fehler der Route als StreamProtocolError", () => {
    const { handler } = setup();
    expect(() => handler.handle(ev("error", { detail: "Anbieter offline" }))).toThrow(StreamProtocolError);
    expect(() => handler.handle(ev("error", { detail: "Anbieter offline" }))).toThrow("Anbieter offline");
  });
});

describe("done", () => {
  const done = { mode: "generated" as const, conversationId: "c1", assistantMessageId: "a1" };

  it("schließt den Text ab, merkt die ID der Antwort und navigiert beim ersten Zug eines neuen Chats", () => {
    const { handler, actions, router, deps } = setup();
    handler.handle(ev("delta", { text: "Fertig" }));
    handler.handle(ev("done", done));
    expect(actions).toContainEqual({ type: "completed", text: "Fertig" });
    expect(deps.pendingAssistantId.current).toBe("a1");
    expect(router.replace).toHaveBeenCalledWith("/chats/c1", { scroll: false });
  });

  it("in einem Projekt führt die Adresse über das Projekt", () => {
    const { handler, router } = setup({ projectId: "p9" });
    handler.handle(ev("done", done));
    expect(router.replace).toHaveBeenCalledWith("/projects/p9/chats/c1", { scroll: false });
  });

  it("navigiert nicht, wenn der Chat nicht mehr eingehängt ist", () => {
    const { handler, router } = setup({ mounted: { current: false } });
    handler.handle(ev("done", done));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("navigiert nicht in einem bestehenden Chat", () => {
    const { handler, router } = setup({ conversationId: "c1", initialConversationId: "c1" });
    handler.handle(ev("done", done));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("navigiert nicht, wenn die Antwort nicht gespeichert werden konnte: warnt und merkt keine ID", () => {
    const { handler, actions, router, deps } = setup();
    handler.handle(ev("done", { ...done, persistError: "persist_failed" }));
    expect(actions).toContainEqual({ type: "persistWarned", message: "nicht gespeichert" });
    expect(router.replace).not.toHaveBeenCalled();
    expect(deps.pendingAssistantId.current).toBeNull();
  });

  it("nach meta lädt done die Seitenleiste nicht ein zweites Mal neu", () => {
    const { handler, router } = setup();
    handler.handle(ev("meta", { conversationId: "c1" }));
    handler.handle(ev("done", done));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("ohne meta ist die Konversation in done der Rückfall", () => {
    const { handler, actions } = setup();
    handler.handle(ev("done", done));
    expect(actions).toContainEqual({ type: "conversationAdopted", id: "c1" });
  });

  it("ein done ohne Kontextfelder schließt den Text trotzdem ab", () => {
    const { handler, actions, router } = setup();
    handler.handle(ev("done", {}));
    expect(actions).toEqual([{ type: "completed", text: "" }]);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
