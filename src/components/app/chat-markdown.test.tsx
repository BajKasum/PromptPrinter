import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkdownMessage } from "./chat-markdown";

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
});

// userEvent.setup() installs its own navigator.clipboard stub internally, so
// our mock must be defined *after* setup() runs or it gets shadowed.
function setupWithClipboardMock() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return user;
}

describe("MarkdownMessage", () => {
  it("renders headings, lists, and inline formatting", () => {
    render(
      <MarkdownMessage
        content={"# Title\n\n- one\n- two\n\n**bold** and *em*"}
      />
    );
    expect(screen.getByRole("heading", { level: 2, name: "Title" })).toBeInTheDocument();
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
  });

  it("opens links in a new tab safely", () => {
    render(<MarkdownMessage content={"[docs](https://example.com/docs)"} />);
    const link = screen.getByRole("link", { name: "docs" });
    expect(link).toHaveAttribute("href", "https://example.com/docs");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("renders a fenced code block with a copy button", () => {
    render(<MarkdownMessage content={"```\nconst x = 1;\n```"} />);
    expect(screen.getByText("const x = 1;")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Prompt kopieren/ })).toBeInTheDocument();
  });

  it("renders inline code without a copy button", () => {
    render(<MarkdownMessage content={"use `npm install` to set up"} />);
    expect(screen.getByText("npm install")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Prompt kopieren/ })).not.toBeInTheDocument();
  });

  it("copies the code block content and flashes a confirmation", async () => {
    const user = setupWithClipboardMock();
    render(<MarkdownMessage content={"```\nhello world\n```"} />);
    await user.click(screen.getByRole("button", { name: /Prompt kopieren/ }));
    expect(writeText).toHaveBeenCalledWith("hello world");
    expect(await screen.findByRole("button", { name: /Kopiert/ })).toBeInTheDocument();
  });
});
