import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Chat } from "./chat";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

// The real PacketBridge/PromptSave open (autoOpen) by calling
// onOpenChange(true) in an effect on mount — Chat relies on that to hide the
// composer and collapse the transcript, so the stub mirrors it.
vi.mock("@/components/app/packet-bridge", () => ({
  PacketBridge: ({
    onBack,
    onOpenChange,
  }: {
    onBack: () => void;
    onOpenChange?: (open: boolean) => void;
  }) => {
    useEffect(() => {
      onOpenChange?.(true);
    }, [onOpenChange]);
    return (
      <div data-testid="packet-bridge">
        Software-Paket-Handoff
        <button onClick={onBack}>Zurück</button>
      </div>
    );
  },
}));

vi.mock("@/components/app/prompt-save", () => ({
  PromptSave: ({
    onBack,
    onOpenChange,
  }: {
    onBack: () => void;
    onOpenChange?: (open: boolean) => void;
  }) => {
    useEffect(() => {
      onOpenChange?.(true);
    }, [onOpenChange]);
    return (
      <div data-testid="prompt-save">
        Prompt-Speichern-Handoff
        <button onClick={onBack}>Zurück</button>
      </div>
    );
  },
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

  it("shows the empty state with starters when there are no messages", () => {
    render(<Chat mode="general" />);
    expect(screen.getByText("Woran arbeiten wir?")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Ich hab eine App-Idee — bau mir das komplette Prompt-Paket dafür.",
      })
    ).toBeInTheDocument();
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

  it("only offers the handoff menu once an assistant reply exists", async () => {
    mockFetchOnce({ reply: "Erledigt.", conversationId: "conv-1" });
    render(<Chat mode="general" />);
    expect(screen.queryByRole("button", { name: "Nächster Schritt" })).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));

    expect(await screen.findByRole("button", { name: "Nächster Schritt" })).toBeInTheDocument();
  });

  it("opens the packet handoff and hides the composer while it's on stage", async () => {
    mockFetchOnce({ reply: "Erledigt.", conversationId: "conv-1" });
    render(<Chat mode="general" />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));
    await screen.findByRole("button", { name: "Nächster Schritt" });

    await user.click(screen.getByRole("button", { name: "Nächster Schritt" }));
    await user.click(screen.getByText("Software-Paket bauen"));

    expect(screen.getByTestId("packet-bridge")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Senden/ })).not.toBeInTheDocument();
  });

  it("collapses the transcript to a conversation strip while the handoff card is open", async () => {
    mockFetchOnce({ reply: "Erledigt.", conversationId: "conv-1" });
    render(<Chat mode="general" />);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Beschreib, woran wir arbeiten…"), "Hi");
    await user.click(screen.getByRole("button", { name: /Senden/ }));
    await screen.findByRole("button", { name: "Nächster Schritt" });

    await user.click(screen.getByRole("button", { name: "Nächster Schritt" }));
    await user.click(screen.getByText("Prompt speichern"));

    expect(screen.getByTestId("prompt-save")).toBeInTheDocument();
    expect(screen.getByText(/Dein Chat/)).toBeInTheDocument();
    expect(screen.queryByText("Hi")).not.toBeInTheDocument();
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
