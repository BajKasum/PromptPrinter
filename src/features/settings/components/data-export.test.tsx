import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataExport } from "./data-export";
import { de } from "@/shared/i18n/messages/de";

describe("DataExport", () => {
  it("ist ein Download-Link auf die Export-Route, kein Skript", () => {
    render(<DataExport />);
    const link = screen.getByRole("link", { name: de.settings.dataExport.button });
    expect(link).toHaveAttribute("href", "/api/account/export");
    expect(link).toHaveAttribute("download");
  });

  it("sagt, was drin ist und was nicht, in einem Satz", () => {
    render(<DataExport />);
    expect(screen.getByText(de.settings.dataExport.body)).toBeInTheDocument();
    // Dass API-Keys nicht dabei sind, gehört zur Zusage und darf nicht still
    // aus dem Text fallen.
    expect(de.settings.dataExport.body).toMatch(/API-Keys/);
  });
});
