import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountMenu } from "./account-menu";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/chats",
  useRouter: () => ({ push, refresh }),
}));

function renderMenu() {
  render(<AccountMenu collapsed={false} email="finn@example.com" plan="free" isAdmin={false} />);
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Kontomenü" }));
}

describe("AccountMenu: Mehr erfahren", () => {
  beforeEach(() => push.mockClear());

  it("is closed until asked for", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu(user);
    const trigger = screen.getByRole("button", { name: "Mehr erfahren" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "Mehr erfahren" })).not.toBeInTheDocument();
  });

  it("lists help and every legal text, each in a new tab", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu(user);
    await user.click(screen.getByRole("button", { name: "Mehr erfahren" }));
    const group = screen.getByRole("group", { name: "Mehr erfahren" });
    const hrefs = Array.from(group.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/docs",
      "/agb",
      "/nutzungsrichtlinie",
      "/datenschutz",
      "/cookies",
      "/rueckerstattung",
      "/impressum",
    ]);
    for (const a of Array.from(group.querySelectorAll("a"))) {
      expect(a).toHaveAttribute("target", "_blank");
    }
  });

  it("opens from the keyboard and moves focus into the panel", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu(user);
    screen.getByRole("button", { name: "Mehr erfahren" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("link", { name: /Hilfe und Anleitungen/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("link", { name: /Nutzungsbedingungen/ })).toHaveFocus();
  });

  it("closes the submenu on the first Escape and the whole menu on the second", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu(user);
    await user.click(screen.getByRole("button", { name: "Mehr erfahren" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Mehr erfahren" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mehr erfahren" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Mehr erfahren" })).not.toBeInTheDocument();
  });
});
