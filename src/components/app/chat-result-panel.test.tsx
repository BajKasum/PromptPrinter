import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatResultPanel } from "./chat-result-panel";

describe("ChatResultPanel", () => {
  it("renders the result content as markdown inside a labeled region", () => {
    render(<ChatResultPanel content={"# Produktplan\n\nEin Absatz."} />);
    expect(screen.getByRole("region", { name: "Aktuelles Ergebnis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Produktplan" })).toBeInTheDocument();
    expect(screen.getByText("Ein Absatz.")).toBeInTheDocument();
  });
});
