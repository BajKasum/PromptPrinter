import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileNav } from "./mobile-nav";

let pathname = "/chats";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("@/components/app/new-project", () => ({
  NewProjectButton: () => <div data-testid="new-project-button" />,
}));

const chats = [
  { id: "c1", title: "Erste Idee" },
  { id: "c2", title: "Zweite Idee" },
];
const projects = [{ id: "p1", name: "Alpha", isFavorite: true }];

describe("MobileNav", () => {
  beforeEach(() => {
    pathname = "/chats";
    document.body.style.overflow = "";
  });

  it("is closed by default", () => {
    render(<MobileNav chats={chats} projects={[]} />);
    expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument();
  });

  it("opens the drawer, shows the chat list, and locks body scroll", async () => {
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));

    expect(screen.getByText("Erste Idee")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes on Escape and restores body scroll", async () => {
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe("");
  });

  it("closes when the backdrop is clicked", async () => {
    // Both the backdrop and the X button share the "Menü schliessen" label —
    // the backdrop is the first one in DOM order.
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));
    const [backdrop] = screen.getAllByRole("button", { name: "Menü schliessen" });
    await user.click(backdrop);

    // AnimatePresence keeps the drawer mounted through its exit transition.
    await waitFor(() => expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument());
  });

  it("closes when a chat link is tapped", async () => {
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));
    await user.click(screen.getByText("Erste Idee"));

    await waitFor(() => expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument());
  });

  it("closes automatically when the route changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));
    expect(screen.getByText("Erste Idee")).toBeInTheDocument();

    pathname = "/chats/c1";
    rerender(<MobileNav chats={chats} projects={[]} />);

    await waitFor(() => expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument());
  });

  it("marks the active chat and shows the empty hint when there are none", async () => {
    pathname = "/chats/c2";
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));

    expect(screen.getByText("Zweite Idee").closest("a")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("shows the projects list with favorites when on a /projects route", async () => {
    pathname = "/projects/p1";
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={projects} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));

    expect(screen.getByText("Alpha").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Angepinnt")).toBeInTheDocument();
    expect(screen.queryByText("Erste Idee")).not.toBeInTheDocument();
  });

  it("shows the empty-projects hint", async () => {
    pathname = "/projects";
    const user = userEvent.setup();
    render(<MobileNav chats={chats} projects={[]} />);
    await user.click(screen.getByRole("button", { name: "Menü öffnen" }));

    expect(screen.getByText("Noch kein Projekt angelegt.")).toBeInTheDocument();
  });
});
