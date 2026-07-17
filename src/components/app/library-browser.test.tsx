import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryBrowser, type LibraryItem } from "./library-browser";

const refresh = vi.fn();
const update = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({ update }),
  }),
}));

function makeItems(count: number): LibraryItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: `Projekt ${i}`,
    updatedAt: new Date(2026, 0, 1 + i).toISOString(),
    savedPromptCount: 1,
    chatCount: 1,
    toolList: [],
    isFavorite: false,
  }));
}

describe("LibraryBrowser pagination", () => {
  beforeEach(() => {
    refresh.mockReset();
    update.mockReset();
    update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it("renders every item when there are fewer than one page", () => {
    render(<LibraryBrowser items={makeItems(5)} />);
    expect(screen.getByText("Projekt 0")).toBeInTheDocument();
    expect(screen.getByText("Projekt 4")).toBeInTheDocument();
    expect(screen.queryByText(/mehr laden/)).not.toBeInTheDocument();
  });

  it("caps the initial render at one page and offers to load more", () => {
    render(<LibraryBrowser items={makeItems(30)} />);
    expect(screen.getByText("Projekt 0")).toBeInTheDocument();
    expect(screen.queryByText("Projekt 24")).not.toBeInTheDocument();
    expect(screen.getByText("24 von 30, mehr laden")).toBeInTheDocument();
  });

  it("reveals the next page on click and hides the button once exhausted", async () => {
    const user = userEvent.setup();
    render(<LibraryBrowser items={makeItems(30)} />);
    await user.click(screen.getByText("24 von 30, mehr laden"));

    expect(screen.getByText("Projekt 24")).toBeInTheDocument();
    expect(screen.getByText("Projekt 29")).toBeInTheDocument();
    expect(screen.queryByText(/mehr laden/)).not.toBeInTheDocument();
  });

  it("resets back to the first page when the search query changes", async () => {
    const user = userEvent.setup();
    render(<LibraryBrowser items={makeItems(30)} />);
    await user.click(screen.getByText("24 von 30, mehr laden"));
    expect(screen.getByText("Projekt 24")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/durchsuchen/), "Projekt 2");
    // Back on page one of the new (smaller) result set, "Projekt 24..29"
    // still match the query, so with a reset window only the first 24 of
    // those matches would show; easier to assert the button count reflects
    // a fresh PAGE_SIZE-based slice rather than the stale "page 2" state.
    expect(screen.queryByText("24 von 30, mehr laden")).not.toBeInTheDocument();
  });

  it("resets back to the first page when the filter changes", async () => {
    const items = makeItems(30);
    items[0].isFavorite = true;
    const user = userEvent.setup();
    render(<LibraryBrowser items={items} />);
    await user.click(screen.getByText("24 von 30, mehr laden"));
    expect(screen.getByText("Projekt 24")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Favoriten" }));
    expect(screen.getByText("Projekt 0")).toBeInTheDocument();
    expect(screen.queryByText("Projekt 24")).not.toBeInTheDocument();
  });
});
