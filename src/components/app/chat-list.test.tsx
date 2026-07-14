import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatList, type ChatListItem } from "./chat-list";

const refresh = vi.fn();
const toast = vi.fn();
const update = vi.fn();
const del = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      update,
      delete: del,
    }),
  }),
}));

const chat: ChatListItem = {
  id: "chat-1",
  title: "Alte Idee",
  target: null,
  updatedAt: new Date().toISOString(),
  messageCount: 2,
};

describe("ChatList", () => {
  beforeEach(() => {
    refresh.mockReset();
    toast.mockReset();
    update.mockReset();
    del.mockReset();
    update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    del.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it("renders the move-to-project button only for the global list", () => {
    render(<ChatList chats={[chat]} basePath="/chats" />);
    expect(
      screen.getByRole("button", { name: `Chat „${chat.title}“ in ein Projekt verschieben` })
    ).toBeInTheDocument();
  });

  it("hides the move-to-project button inside a project's own chat list", () => {
    render(<ChatList chats={[chat]} basePath="/projects/p1/chats" />);
    expect(
      screen.queryByRole("button", { name: `Chat „${chat.title}“ in ein Projekt verschieben` })
    ).not.toBeInTheDocument();
  });

  it("renames a chat, returns to view mode, and refreshes", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    update.mockReturnValue({ eq });
    const user = userEvent.setup();
    render(<ChatList chats={[chat]} />);

    await user.click(screen.getByRole("button", { name: `Chat „${chat.title}“ umbenennen` }));
    const input = screen.getByLabelText("Neuer Chat-Titel");
    await user.clear(input);
    await user.type(input, "Neuer Titel{Enter}");

    expect(update).toHaveBeenCalledWith({ title: "Neuer Titel" });
    expect(eq).toHaveBeenCalledWith("id", "chat-1");
    // The row itself still shows the prop's title, a real rename only
    // reflects once router.refresh() re-fetches the server data; this only
    // asserts the row leaves rename mode (the input disappears).
    await waitFor(() => {
      expect(screen.queryByLabelText("Neuer Chat-Titel")).not.toBeInTheDocument();
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("cancels a rename on Escape without calling Supabase", async () => {
    const user = userEvent.setup();
    render(<ChatList chats={[chat]} />);

    await user.click(screen.getByRole("button", { name: `Chat „${chat.title}“ umbenennen` }));
    const input = screen.getByLabelText("Neuer Chat-Titel");
    await user.type(input, " geändert");
    await user.keyboard("{Escape}");

    expect(update).not.toHaveBeenCalled();
    expect(screen.getByText(chat.title)).toBeInTheDocument();
  });

  it("does not rename to an empty title", async () => {
    const user = userEvent.setup();
    render(<ChatList chats={[chat]} />);

    await user.click(screen.getByRole("button", { name: `Chat „${chat.title}“ umbenennen` }));
    const input = screen.getByLabelText("Neuer Chat-Titel");
    await user.clear(input);
    await user.keyboard("{Enter}");

    expect(update).not.toHaveBeenCalled();
    expect(screen.getByText(chat.title)).toBeInTheDocument();
  });

  it("shows a toast and stays in rename mode when the rename fails", async () => {
    update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: "fail" } }) });
    const user = userEvent.setup();
    render(<ChatList chats={[chat]} />);

    await user.click(screen.getByRole("button", { name: `Chat „${chat.title}“ umbenennen` }));
    const input = screen.getByLabelText("Neuer Chat-Titel");
    await user.type(input, " geändert{Enter}");

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    expect(screen.getByLabelText("Neuer Chat-Titel")).toBeInTheDocument();
  });

  it("requires a confirm step before deleting", async () => {
    const user = userEvent.setup();
    render(<ChatList chats={[chat]} />);

    await user.click(screen.getByRole("button", { name: `Chat „${chat.title}“ löschen` }));
    expect(screen.getByText(/endgültig löschen\?/)).toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(screen.getByText(chat.title)).toBeInTheDocument();
  });

  it("deletes the chat after confirming and shows a success toast", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    del.mockReturnValue({ eq });
    const user = userEvent.setup();
    render(<ChatList chats={[chat]} />);

    await user.click(screen.getByRole("button", { name: `Chat „${chat.title}“ löschen` }));
    await user.click(screen.getByRole("button", { name: "Löschen" }));

    expect(eq).toHaveBeenCalledWith("id", "chat-1");
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an error toast and does not refresh when delete fails", async () => {
    del.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: "fail" } }) });
    const user = userEvent.setup();
    render(<ChatList chats={[chat]} />);

    await user.click(screen.getByRole("button", { name: `Chat „${chat.title}“ löschen` }));
    await user.click(screen.getByRole("button", { name: "Löschen" }));

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    expect(refresh).not.toHaveBeenCalled();
  });
});
