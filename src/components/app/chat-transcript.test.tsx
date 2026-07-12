import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ChatAssistantBubble,
  ChatConversationStrip,
  ChatTyping,
  ChatUserBubble,
} from "./chat-transcript";

describe("ChatUserBubble", () => {
  it("renders the message content", () => {
    render(<ChatUserBubble content="Baue mir eine Todo-App" />);
    expect(screen.getByText("Baue mir eine Todo-App")).toBeInTheDocument();
  });
});

describe("ChatConversationStrip", () => {
  it("pluralizes a single message correctly", () => {
    render(<ChatConversationStrip count={1} />);
    expect(screen.getByText(/1 Nachricht$/)).toBeInTheDocument();
  });

  it("pluralizes multiple messages correctly", () => {
    render(<ChatConversationStrip count={3} />);
    expect(screen.getByText(/3 Nachrichten/)).toBeInTheDocument();
  });
});

describe("ChatTyping", () => {
  it("shows a status indicator", () => {
    render(<ChatTyping />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("ChatAssistantBubble", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
  });

  it("renders the reply as markdown", () => {
    render(<ChatAssistantBubble content="**Hallo**" index={0} />);
    expect(screen.getByText("Hallo")).toBeInTheDocument();
  });

  it("copies the raw reply content when 'Antwort kopieren' is clicked", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<ChatAssistantBubble content="the full reply" index={0} />);
    await user.click(screen.getByRole("button", { name: /Antwort kopieren/ }));
    expect(writeText).toHaveBeenCalledWith("the full reply");
  });

  it("exports the reply as a numbered markdown file", async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ChatAssistantBubble content="reply body" index={2} />);
    await user.click(screen.getByRole("button", { name: /Export/ }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });
});
