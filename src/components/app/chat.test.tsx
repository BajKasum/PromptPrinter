import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Chat } from "./chat";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

// Pre-flight failures (400/401/403/429) still return a plain JSON problem
// response, unchanged by streaming, see /api/chat.
function mockFetchOnce(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: async () => body,
    })
  );
}

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// A successful reply is streamed as the route's own SSE protocol: zero or
// more "delta" events, then exactly one "done" (or "error"). `events` takes
// just the deltas' text plus the final "done" payload for brevity.
function mockStreamingFetch(deltas: string[], done: Record<string, unknown> = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const text of deltas) controller.enqueue(encoder.encode(sseFrame("delta", { text })));
      controller.enqueue(encoder.encode(sseFrame("done", done)));
      controller.close();
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, body, json: async () => ({}) })
  );
}

describe("Chat", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    vi.unstubAllGlobals();
  });

  it("shows just Finn's greeting when there are no messages", () => {
    render(<Chat mode="general" />);
    expect(screen.getByText("Woran arbeiten wir?")).toBeInTheDocument();
  });

  it("personalizes the greeting with the user's name when given", () => {
    render(<Chat mode="general" name="Kasum" />);
    expect(screen.getByText("Woran arbeiten wir, Kasum?")).toBeInTheDocument();
  });

  it("sends a message, shows it optimistically, and renders the streamed reply", async () => {
    mockStreamingFetch(["Hier ", "ist dein Plan."], { conversationId: "conv-1" });
    render(<Chat mode="general" />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hallo Finn");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    expect(screen.getByText("Hallo Finn")).toBeInTheDocument();
    // A reply is written out in the live preview bubble first and only moves
    // into the result panel once it's fully revealed (see chat.tsx), so the
    // node carrying the text is replaced mid-turn. Wait for the turn to settle
    // (send button back) and query the DOM again, rather than holding on to a
    // node captured during the transition.
    await screen.findByRole("button", { name: /Senden/ });
    expect(screen.getByText("Hier ist dein Plan.")).toBeInTheDocument();

    // Each outgoing user message carries a client-generated id (React key,
    // see chat.tsx's Msg type), so the body can't be a fixed JSON string
    // anymore, parse it and check structurally instead.
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("/api/chat");
    expect(call[1].method).toBe("POST");
    const body = JSON.parse(call[1].body);
    expect(body.mode).toBe("general");
    expect(body.messages).toEqual([
      { id: expect.any(String), role: "user", content: "Hallo Finn" },
    ]);
  });

  it("redirects to the canonical chat URL once a fresh conversationId comes back", async () => {
    mockStreamingFetch(["Antwort"], { conversationId: "conv-42" });
    render(<Chat mode="general" />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    await screen.findByText("Antwort");
    expect(replace).toHaveBeenCalledWith("/chats/conv-42", { scroll: false });
    expect(refresh).toHaveBeenCalled();
  });

  it("does not redirect again once a conversationId is already established", async () => {
    mockStreamingFetch(["Zweite Antwort"], { conversationId: "conv-1" });
    render(
      <Chat
        mode="general"
        initialConversationId="conv-1"
        initialMessages={[
          { id: "m1", role: "user", content: "erste Frage" },
          { id: "m2", role: "assistant", content: "erste Antwort" },
        ]}
      />
    );

    const user = userEvent.setup();
    await user.type(
      screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"),
      "noch was"
    );
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    await screen.findByText("Zweite Antwort");
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows an error and keeps the composer usable when the request fails", async () => {
    mockFetchOnce({ detail: "Server explodiert" }, false);
    render(<Chat mode="general" />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Server explodiert");
  });

  it("shows an error when the stream fails mid-generation", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseFrame("delta", { text: "Teilweise" })));
        controller.enqueue(encoder.encode(sseFrame("error", { detail: "Anbieter offline" })));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body, json: async () => ({}) }));
    render(<Chat mode="general" />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Anbieter offline");
    // The failed turn was never committed to the transcript.
    expect(screen.queryByText("Teilweise")).not.toBeInTheDocument();
  });

  it("warns without blocking the composer when the reply couldn't be persisted", async () => {
    mockStreamingFetch(["Antwort da"], { persistError: "insert failed" });
    render(<Chat mode="general" />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    // Settle the turn first: while the reply is still being written the
    // preview bubble carries its own role="status" ("Schreibt…"), so querying
    // by that role mid-stream would match the wrong element.
    await screen.findByRole("button", { name: /Senden/ });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "konnte aber gerade nicht gespeichert werden"
    );
    // The warning must not block the composer, the input is only empty
    // (post-send), not stuck loading, typing re-enables the send button.
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "weiter geht's");
    expect(screen.getByRole("button", { name: /Senden/ })).not.toBeDisabled();
  });

  it("clears a persist warning once the next turn saves successfully", async () => {
    mockStreamingFetch(["Erste Antwort"], { persistError: "insert failed" });
    render(<Chat mode="general" />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));
    await screen.findByRole("status");

    mockStreamingFetch(["Zweite Antwort"], { conversationId: "conv-9" });
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Nochmal");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    // Again, only meaningful once the turn has settled: the live "Schreibt…"
    // indicator is itself a role="status", so this must not run mid-stream.
    await screen.findByRole("button", { name: /Senden/ });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("swaps send for a stop button while a request is in flight, streaming text in as it grows", async () => {
    let controllerRef!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controllerRef = controller;
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body, json: async () => ({}) }));
    render(<Chat mode="general" />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    expect(screen.queryByRole("button", { name: /Senden/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stoppen/ })).not.toBeDisabled();

    const encoder = new TextEncoder();
    controllerRef.enqueue(encoder.encode(sseFrame("delta", { text: "spät" })));
    expect(await screen.findByText("spät")).toBeInTheDocument();
    // Still in flight (no "done" yet), the stop button stays up while the
    // live preview bubble is showing partial text.
    expect(screen.getByRole("button", { name: /stoppen/ })).toBeInTheDocument();

    controllerRef.enqueue(encoder.encode(sseFrame("done", {})));
    controllerRef.close();
    await screen.findByText("spät");
    expect(await screen.findByRole("button", { name: /Senden/ })).toBeInTheDocument();
  });

  it("stops generation on click, keeping whatever text had already streamed in", async () => {
    // Mirrors what really happens on abort: fetch() itself has already
    // resolved (the response headers arrived), it's the body *read* that
    // rejects once the connection tears down, so the abort listener errors
    // the stream's controller rather than rejecting the fetch call.
    let controllerRef!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controllerRef = controller;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const signal = init.signal as AbortSignal;
        signal.addEventListener("abort", () => {
          controllerRef.error(new DOMException("aborted", "AbortError"));
        });
        return { ok: true, body, json: async () => ({}) };
      })
    );
    render(<Chat mode="general" />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    const encoder = new TextEncoder();
    controllerRef.enqueue(encoder.encode(sseFrame("delta", { text: "Teilweise da" })));
    await screen.findByText("Teilweise da");

    await user.click(screen.getByRole("button", { name: /stoppen/ }));

    // The partial reply is kept, not discarded, and no error banner appears
    // for a stop the user asked for.
    expect(await screen.findByRole("button", { name: /Senden/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  // QA finding F-4: a failed turn used to leave the user's message in the
  // thread with no reply AND clear the composer, so the text was gone and the
  // transcript carried two consecutive user turns as soon as they typed again
  // — a shape BYOK-Anthropic rejects outright.
  describe("a failed turn (QA finding F-4)", () => {
    async function failWith(body: Record<string, unknown>) {
      mockFetchOnce(body, false);
      render(<Chat mode="general" />);
      await userEvent.type(screen.getByRole("textbox"), "Baue mir eine Todo-App");
      await userEvent.click(screen.getByRole("button", { name: /Senden/ }));
    }

    it("takes the unsent message back out of the transcript", async () => {
      await failWith({ detail: "Chat fehlgeschlagen" });
      // The thread is rendered as role="log"; with the optimistic message rolled
      // back the chat is empty again and the greeting takes its place. Asserting
      // on the absence of the text alone would pass trivially, since the same
      // string is now sitting in the composer.
      expect(screen.queryByRole("log")).not.toBeInTheDocument();
      expect(screen.getByText("Woran arbeiten wir?")).toBeInTheDocument();
    });

    it("puts the text back in the composer instead of losing it", async () => {
      await failWith({ detail: "Chat fehlgeschlagen" });
      expect(screen.getByRole("textbox")).toHaveValue("Baue mir eine Todo-App");
    });

    it("shows the failure with a way to act on it", async () => {
      await failWith({ detail: "Chat fehlgeschlagen" });
      expect(screen.getByRole("alert")).toHaveTextContent("Chat fehlgeschlagen");
      expect(screen.getByRole("button", { name: /Erneut senden/ })).toBeInTheDocument();
    });

    it("retries the same text on demand", async () => {
      await failWith({ detail: "Chat fehlgeschlagen" });
      mockStreamingFetch(["Klar,"], { conversationId: "conv-1" });

      await userEvent.click(screen.getByRole("button", { name: /Erneut senden/ }));

      expect(await screen.findByText("Baue mir eine Todo-App")).toBeInTheDocument();
    });

    it("says how long a rate limit lasts rather than leaving the user guessing", async () => {
      await failWith({ detail: "Zu viele Anfragen.", retryAfter: 120 });
      expect(screen.getByRole("alert")).toHaveTextContent("in 2 Minuten");
    });

    it("offers no retry while rate-limited, since it would only 429 again", async () => {
      await failWith({ detail: "Zu viele Anfragen.", retryAfter: 120 });
      expect(screen.queryByRole("button", { name: /Erneut senden/ })).not.toBeInTheDocument();
    });
  });
});
