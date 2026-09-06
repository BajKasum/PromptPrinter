import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemePreference } from "./theme-preference";

const setTheme = vi.fn();
let currentTheme = "dark";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: currentTheme, setTheme }),
}));

// B-10 (Audit 06.09.2026, zweiter Durchgang): role="radiogroup" +
// role="radio" versprachen das WAI-ARIA Radio-Group-Pattern, aber weder war
// nur ein Radio per Tab erreichbar, noch tat eine Pfeiltaste etwas.
describe("ThemePreference", () => {
  beforeEach(() => {
    setTheme.mockReset();
    currentTheme = "dark";
  });

  it("hat nur das aktive Radio im Tab-Index, die anderen sind -1", () => {
    render(<ThemePreference />);
    expect(screen.getByRole("radio", { name: "Dunkel" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Hell" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute("tabindex", "-1");
  });

  it("wechselt mit Pfeil-rechts zur naechsten Option und setzt den Fokus mit", async () => {
    render(<ThemePreference />);
    const user = userEvent.setup();
    screen.getByRole("radio", { name: "Dunkel" }).focus();

    await user.keyboard("{ArrowRight}");

    expect(setTheme).toHaveBeenCalledWith("system");
    expect(screen.getByRole("radio", { name: "System" })).toHaveFocus();
  });

  it("springt am Ende der Liste mit Pfeil-rechts zurueck an den Anfang", async () => {
    currentTheme = "system";
    render(<ThemePreference />);
    const user = userEvent.setup();
    screen.getByRole("radio", { name: "System" }).focus();

    await user.keyboard("{ArrowRight}");

    expect(setTheme).toHaveBeenCalledWith("light");
    expect(screen.getByRole("radio", { name: "Hell" })).toHaveFocus();
  });

  it("wechselt mit Pfeil-links zur vorherigen Option, mit Umbruch am Anfang", async () => {
    currentTheme = "light";
    render(<ThemePreference />);
    const user = userEvent.setup();
    screen.getByRole("radio", { name: "Hell" }).focus();

    await user.keyboard("{ArrowLeft}");

    expect(setTheme).toHaveBeenCalledWith("system");
    expect(screen.getByRole("radio", { name: "System" })).toHaveFocus();
  });

  it("springt mit Home/End an Anfang und Ende", async () => {
    render(<ThemePreference />);
    const user = userEvent.setup();
    screen.getByRole("radio", { name: "Dunkel" }).focus();

    await user.keyboard("{End}");
    expect(setTheme).toHaveBeenLastCalledWith("system");

    await user.keyboard("{Home}");
    expect(setTheme).toHaveBeenLastCalledWith("light");
  });
});
