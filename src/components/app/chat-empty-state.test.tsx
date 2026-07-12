import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatEmptyState } from "./chat-empty-state";

describe("ChatEmptyState", () => {
  it("renders the heading, subtext, and every starter", () => {
    render(
      <ChatEmptyState
        heading="Was bauen wir?"
        sub="Beschreib deine Idee."
        starters={["Eine Todo-App", "Ein Blog"]}
        onPick={vi.fn()}
        disabled={false}
      />
    );
    expect(screen.getByText("Was bauen wir?")).toBeInTheDocument();
    expect(screen.getByText("Beschreib deine Idee.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eine Todo-App" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ein Blog" })).toBeInTheDocument();
  });

  it("calls onPick with the clicked starter's text", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <ChatEmptyState
        heading="h"
        sub="s"
        starters={["Eine Todo-App", "Ein Blog"]}
        onPick={onPick}
        disabled={false}
      />
    );
    await user.click(screen.getByRole("button", { name: "Ein Blog" }));
    expect(onPick).toHaveBeenCalledWith("Ein Blog");
  });

  it("disables every starter button when disabled is true", () => {
    render(
      <ChatEmptyState
        heading="h"
        sub="s"
        starters={["A", "B"]}
        onPick={vi.fn()}
        disabled
      />
    );
    expect(screen.getByRole("button", { name: "A" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "B" })).toBeDisabled();
  });
});
