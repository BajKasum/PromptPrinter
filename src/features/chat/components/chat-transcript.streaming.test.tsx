import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatAssistantBubble, ChatStreamingReply } from "./chat-transcript";

// Der Block mit Antwortvorschlägen (#225) darf nie als Codeblock aufblitzen, auch nicht, solange er noch
// geschrieben wird. Der Text kommt hier ungebremst an, damit der Test nicht auf die Schreibanimation wartet.
vi.mock("@/features/chat/hooks/use-smooth-stream", () => ({
  useSmoothStream: (text: string) => ({ text, settled: false }),
}));

describe("ChatStreamingReply: Antwortvorschläge", () => {
  it("zeigt einen noch offenen Block nicht", () => {
    render(<ChatStreamingReply text={"Wie soll er klingen?\n\n```choices\nTon? | sachlich | fre"} complete={false} onRevealed={vi.fn()} />);
    expect(screen.getByText("Wie soll er klingen?")).toBeInTheDocument();
    expect(screen.queryByText(/choices|sachlich/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Prompt kopieren/ })).not.toBeInTheDocument();
  });

  it("zeigt einen fertigen Block nicht", () => {
    render(<ChatStreamingReply text={"Wie soll er klingen?\n\n```choices\nTon? | sachlich | freundlich\n```"} complete onRevealed={vi.fn()} />);
    expect(screen.queryByText(/sachlich/)).not.toBeInTheDocument();
  });

  it("lässt einen Prompt-Block unberührt", () => {
    render(<ChatStreamingReply text={"Hier:\n\n```text\nDu bist ein Tutor.\n```"} complete={false} onRevealed={vi.fn()} />);
    expect(screen.getByText("Du bist ein Tutor.")).toBeInTheDocument();
  });
});

describe("ChatAssistantBubble: ältere Antwort mit Vorschlägen", () => {
  it("blendet den abgelaufenen Block aus", () => {
    render(<ChatAssistantBubble content={"Frage?\n\n```choices\nTon? | sachlich | freundlich\n```"} index={0} />);
    expect(screen.getByText("Frage?")).toBeInTheDocument();
    expect(screen.queryByText(/sachlich/)).not.toBeInTheDocument();
  });
});
