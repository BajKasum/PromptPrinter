import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatHandoffMenu } from "./chat-handoff-menu";

function setup(isWorkspace = false) {
  const onSave = vi.fn();
  const onPacket = vi.fn();
  render(<ChatHandoffMenu isWorkspace={isWorkspace} onSave={onSave} onPacket={onPacket} />);
  return { onSave, onPacket };
}

describe("ChatHandoffMenu", () => {
  it("is closed by default", () => {
    setup();
    expect(screen.queryByText("Prompt speichern")).not.toBeInTheDocument();
  });

  it("opens on trigger click and shows chat-mode labels", async () => {
    const user = userEvent.setup();
    setup(false);
    await user.click(screen.getByRole("button", { name: "Nächster Schritt" }));
    expect(screen.getByText("Prompt speichern")).toBeInTheDocument();
    expect(screen.getByText("Software-Paket bauen")).toBeInTheDocument();
  });

  it("shows workspace-mode labels when isWorkspace is true", async () => {
    const user = userEvent.setup();
    setup(true);
    await user.click(screen.getByRole("button", { name: "Nächster Schritt" }));
    expect(screen.getByText("Prompt erzeugen")).toBeInTheDocument();
    expect(screen.getByText("Software-Paket erzeugen")).toBeInTheDocument();
  });

  it("calls onSave and closes when the save item is picked", async () => {
    const user = userEvent.setup();
    const { onSave, onPacket } = setup();
    await user.click(screen.getByRole("button", { name: "Nächster Schritt" }));
    await user.click(screen.getByText("Prompt speichern"));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onPacket).not.toHaveBeenCalled();
    expect(screen.queryByText("Prompt speichern")).not.toBeInTheDocument();
  });

  it("calls onPacket when the packet item is picked", async () => {
    const user = userEvent.setup();
    const { onSave, onPacket } = setup();
    await user.click(screen.getByRole("button", { name: "Nächster Schritt" }));
    await user.click(screen.getByText("Software-Paket bauen"));
    expect(onPacket).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Nächster Schritt" }));
    expect(screen.getByText("Prompt speichern")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Prompt speichern")).not.toBeInTheDocument();
  });

  it("closes on outside click", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Nächster Schritt" }));
    await user.click(screen.getByRole("button", { name: "Menü schliessen" }));
    expect(screen.queryByText("Prompt speichern")).not.toBeInTheDocument();
  });
});
