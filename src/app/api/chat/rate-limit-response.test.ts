import { afterEach, describe, expect, it, vi } from "vitest";
import { runChatTurn, type ChatTurnContext } from "@/features/chat/hooks/run-chat-turn";
import type { TurnAction } from "@/features/chat/lib/turn-state";
import { rateLimitedProblem } from "@/server/http/api-problem";
import { de } from "@/shared/i18n/messages/de";

// Die Stundengrenze des Chats antwortet mit `kind: "rate_limited"` (server/model-call.ts). Im Browser bleibt das die
// gewöhnliche Fehlermeldung mit der Wartezeit: nur byokRequired, freeTrialBudget und consentRequired haben eigene
// Hinweise.
describe("429 des Chats im Browser", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("zeigt den Satz der Route mit der Wartezeit und legt die Frage zurück ins Feld", async () => {
    vi.stubGlobal("fetch", async () => rateLimitedProblem(de.api.tooManyRequests, { resetAt: Date.now() + 90_000 }));
    const actions: TurnAction[] = [];
    const ref = <T>(current: T) => ({ current });
    const ctx: ChatTurnContext = {
      snapshot: { messages: [], conversationId: undefined, projectId: undefined, initialConversationId: undefined },
      t: de,
      router: {} as ChatTurnContext["router"],
      refs: {
        mounted: ref(true),
        pending: ref(null),
        pendingAssistantId: ref(null),
        pendingTruncated: ref(false),
        abortController: ref(null),
      },
      dispatch: (action) => actions.push(action),
      commitReply: () => {},
      restoreAttachments: () => {},
    };

    const reply = await runChatTurn(ctx, [{ id: "frage", role: "user", content: "Hallo" }], "Hallo");

    expect(reply).toBeNull();
    expect(actions.find((action) => action.type === "failed")).toEqual({
      type: "failed",
      before: [],
      input: "Hallo",
      presentation: { kind: "error", message: de.api.tooManyRequests, retryAfter: 90 },
    });
  });
});
