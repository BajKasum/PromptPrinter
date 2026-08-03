import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatEmptyState } from "./chat-empty-state";

describe("ChatEmptyState", () => {
  it("renders just Finn's heading, nothing else", () => {
    render(<ChatEmptyState heading="Woran arbeiten wir, Kasum?" />);
    expect(screen.getByText("Woran arbeiten wir, Kasum?")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
