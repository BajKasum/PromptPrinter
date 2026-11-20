import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MAX_USER_MESSAGE_CHARS } from "@/shared/lib/chat-limits";
import { PromptReuseBar } from "./prompt-reuse-bar";

vi.mock("next/link", () => ({
  default: ({ href, prefetch: _prefetch, ...rest }: { href: string; prefetch?: unknown } & Record<string, unknown>) => (
    <a href={href} {...rest} />
  ),
}));

const ID = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";

describe("PromptReuseBar", () => {
  it("öffnet einen neuen Chat im Projekt des Prompts, mit nur der ID in der Adresse", () => {
    render(<PromptReuseBar promptId={ID} title="Brief" content="Schreib einen Brief." projectId="proj-1" />);
    const link = screen.getByRole("link", { name: "Neuen Chat mit „Brief“ als Ausgangspunkt beginnen" });
    expect(link).toHaveAttribute("href", `/projects/proj-1/chats/new?from=${ID}`);
    expect(link.getAttribute("href")).not.toContain("Brief");
  });

  it("öffnet einen globalen Chat, wenn der Prompt in keinem Projekt liegt", () => {
    render(<PromptReuseBar promptId={ID} title="Brief" content="Schreib einen Brief." projectId={null} />);
    expect(screen.getByRole("link", { name: /Ausgangspunkt/ })).toHaveAttribute("href", `/chats/new?from=${ID}`);
  });

  it("bietet den Weg nicht an, wenn der Prompt nicht in eine Nachricht passt", () => {
    render(<PromptReuseBar promptId={ID} title="Lang" content={"x".repeat(MAX_USER_MESSAGE_CHARS)} />);
    expect(screen.queryByRole("link", { name: /Ausgangspunkt/ })).not.toBeInTheDocument();
  });
});
