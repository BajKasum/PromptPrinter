import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatEmptyState } from "./chat-empty-state";

describe("ChatEmptyState", () => {
  it("renders just Finn's heading when there are no starter ideas", () => {
    render(<ChatEmptyState heading="Woran arbeiten wir, Kasum?" />);
    expect(screen.getByText("Woran arbeiten wir, Kasum?")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("zeigt Startideen als Knöpfe und meldet die gewählte (#156)", async () => {
    const onPick = vi.fn();
    render(
      <ChatEmptyState
        heading="Woran arbeiten wir?"
        suggestionsLabel="Zum Beispiel"
        suggestions={["Ein Prompt für einen Brief", "Ein Prompt für eine Präsentation"]}
        onPick={onPick}
      />
    );

    expect(screen.getByText("Zum Beispiel")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Ein Prompt für eine Präsentation" }));
    expect(onPick).toHaveBeenCalledExactlyOnceWith("Ein Prompt für eine Präsentation");
  });

  it("zeigt keine Knöpfe ohne Empfänger für die Auswahl", () => {
    render(<ChatEmptyState heading="Woran arbeiten wir?" suggestions={["Ein Prompt für einen Brief"]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
