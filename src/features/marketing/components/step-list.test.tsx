import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InstallSteps } from "./step-list";

const STEPS = [
  { title: "Holen", body: "Lade es herunter." },
  { title: "Starten", body: "Gib den Befehl ein.", code: "node install.mjs" },
];

describe("InstallSteps", () => {
  it("nummeriert die Schritte ab eins, mit Überschrift und Text", () => {
    render(<InstallSteps steps={STEPS} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.querySelector("span")?.textContent)).toEqual(["1", "2"]);
    expect(items.map((li) => within(li).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "Holen",
      "Starten",
    ]);
    expect(within(items[0]).getByText("Lade es herunter.")).toBeInTheDocument();
    // Die Nummer ist Dekoration, die Liste selbst zählt schon.
    expect(items[0].querySelector("span")).toHaveAttribute("aria-hidden", "true");
  });

  it("zeigt einen Befehl nur dort, wo es einen gibt", () => {
    render(<InstallSteps steps={STEPS} />);
    const [first, second] = screen.getAllByRole("listitem");
    expect(first.querySelector("pre")).toBeNull();
    expect(second.querySelector("pre code")?.textContent).toBe("node install.mjs");
  });

  it("zeichnet den Nebenweg anders als den Hauptweg", () => {
    const { container: accent } = render(<InstallSteps steps={STEPS} />);
    const { container: plain } = render(<InstallSteps steps={STEPS} tone="plain" />);
    expect(accent.querySelector("ol")).toHaveClass("mt-8");
    expect(plain.querySelector("ol")).toHaveClass("mt-6");
    expect(accent.querySelector("li span")).toHaveClass("border-accent/60", "text-accent-text");
    expect(plain.querySelector("li span")).toHaveClass("border-border", "text-secondary");
    expect(accent.querySelector("pre")).toHaveClass("bg-surface-raised");
    expect(plain.querySelector("pre")).toHaveClass("bg-surface");
    expect(plain.querySelector("li p")).toHaveClass("text-secondary");
  });

  it("setzt den Text über formatBody", () => {
    render(<InstallSteps steps={STEPS} formatBody={(body) => <em>{body}</em>} />);
    expect(screen.getByText("Gib den Befehl ein.").tagName).toBe("EM");
  });
});
