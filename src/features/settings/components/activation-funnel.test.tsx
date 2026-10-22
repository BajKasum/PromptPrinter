import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { de } from "@/shared/i18n/messages/de";
import { ActivationFunnelCard } from "./activation-funnel";

const labels = de.pages.usage.funnel;

const weeks = [
  { weekStart: "2026-10-12", signups: 0, withKey: 0, withAnswer: 0, withSavedPrompt: 0 },
  { weekStart: "2026-10-19", signups: 4, withKey: 3, withAnswer: 2, withSavedPrompt: 1 },
];

describe("ActivationFunnelCard", () => {
  it("zeigt je Anmeldewoche Zähler und Anteil", () => {
    render(
      <ActivationFunnelCard
        funnel={{ weeks, truncated: false, accountLimit: 300 }}
        locale="de"
        labels={labels}
      />
    );

    const rows = screen.getAllByRole("row");
    // Kopfzeile plus die eine Woche mit Anmeldungen; die leere Woche steht nicht drin.
    expect(rows).toHaveLength(2);
    const cells = within(rows[1]).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("4");
    expect(cells[1]).toHaveTextContent("3 75 %");
    expect(cells[2]).toHaveTextContent("2 50 %");
    expect(cells[3]).toHaveTextContent("1 25 %");
  });

  it("sagt, wenn sich niemand angemeldet hat", () => {
    render(
      <ActivationFunnelCard
        funnel={{ weeks: [weeks[0]], truncated: false, accountLimit: 300 }}
        locale="de"
        labels={labels}
      />
    );
    expect(screen.getByText(labels.empty)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("weist auf abgeschnittene Zahlen hin, mit der Obergrenze", () => {
    render(
      <ActivationFunnelCard
        funnel={{ weeks, truncated: true, accountLimit: 300 }}
        locale="de"
        labels={labels}
      />
    );
    expect(screen.getByText(/300/)).toBeInTheDocument();
  });

  it("zeigt den Hinweis nicht, wenn nichts fehlt", () => {
    render(
      <ActivationFunnelCard
        funnel={{ weeks, truncated: false, accountLimit: 300 }}
        locale="de"
        labels={labels}
      />
    );
    expect(screen.queryByText(/300/)).not.toBeInTheDocument();
  });
});
