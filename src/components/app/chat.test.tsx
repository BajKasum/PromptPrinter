import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Chat } from "./chat";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

function mockFetchOnce(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: async () => body,
    })
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

  it("sends a message, shows it optimistically, and renders the reply", async () => {
    mockFetchOnce({ reply: "Hier ist dein Plan.", conversationId: "conv-1" });
    render(<Chat mode="general" />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hallo Finn");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    expect(screen.getByText("Hallo Finn")).toBeInTheDocument();
    expect(await screen.findByText("Hier ist dein Plan.")).toBeInTheDocument();

    expect(fetch).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mode: "general",
          target: undefined,
          conversationId: undefined,
          projectId: undefined,
          messages: [{ role: "user", content: "Hallo Finn" }],
        }),
      })
    );
  });

  it("redirects to the canonical chat URL once a fresh conversationId comes back", async () => {
    mockFetchOnce({ reply: "Antwort", conversationId: "conv-42" });
    render(<Chat mode="general" />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    await screen.findByText("Antwort");
    expect(replace).toHaveBeenCalledWith("/chats/conv-42", { scroll: false });
    expect(refresh).toHaveBeenCalled();
  });

  it("does not redirect again once a conversationId is already established", async () => {
    mockFetchOnce({ reply: "Zweite Antwort", conversationId: "conv-1" });
    render(
      <Chat
        mode="general"
        initialConversationId="conv-1"
        initialMessages={[
          { role: "user", content: "erste Frage" },
          { role: "assistant", content: "erste Antwort" },
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

  it("warns without blocking the composer when the reply couldn't be persisted", async () => {
    mockFetchOnce({ reply: "Antwort da", persistError: "insert failed" });
    render(<Chat mode="general" />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    await screen.findByText("Antwort da");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "konnte aber gerade nicht gespeichert werden"
    );
    // The warning must not block the composer, the input is only empty
    // (post-send), not stuck loading, typing re-enables the send button.
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "weiter geht's");
    expect(screen.getByRole("button", { name: /Senden/ })).not.toBeDisabled();
  });

  it("clears a persist warning once the next turn saves successfully", async () => {
    mockFetchOnce({ reply: "Erste Antwort", persistError: "insert failed" });
    render(<Chat mode="general" />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));
    await screen.findByRole("status");

    mockFetchOnce({ reply: "Zweite Antwort", conversationId: "conv-9" });
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Nochmal");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    await screen.findByText("Zweite Antwort");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("disables the send button while a request is in flight", async () => {
    let resolveFetch!: (v: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
      )
    );
    render(<Chat mode="general" />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    expect(screen.getByRole("button", { name: /Senden/ })).toBeDisabled();
    resolveFetch({ ok: true, json: async () => ({ reply: "spät" }) });
    expect(await screen.findByText("spät")).toBeInTheDocument();
  });
});
