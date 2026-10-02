import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { okWrite, failedWrite } from "@tests/support/supabase-query";
import { ChatList, type ChatListItem } from "./chat-list";

const refresh = vi.fn();
const toast = vi.fn();
const update = vi.fn();
const del = vi.fn();
// Aufraeumen der Anhaenge: die Pfade, die die Abfrage liefert, und der Aufruf,
// der die Objekte entfernt.
const attachmentRange = vi.fn();
const storageRemove = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/shared/ui/toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) =>
      table === "message_attachments"
        ? {
            select: () => ({
              eq: () => ({ eq: () => ({ range: (...a: unknown[]) => attachmentRange(...a) }) }),
            }),
          }
        : { update, delete: del },
    storage: { from: (bucket: string) => ({ remove: (p: string[]) => storageRemove(bucket, p) }) },
  }),
}));

const chat: ChatListItem = {
  id: "chat-1",
  title: "Alte Idee",
  updatedAt: new Date().toISOString(),
  messageCount: 2,
};

describe("ChatList", () => {
  beforeEach(() => {
    refresh.mockReset();
    toast.mockReset();
    update.mockReset();
    del.mockReset();
    attachmentRange.mockReset();
    storageRemove.mockReset();
    update.mockReturnValue(okWrite());
    del.mockReturnValue(okWrite());
    attachmentRange.mockResolvedValue({ data: [], error: null });
    storageRemove.mockResolvedValue({ error: null });
  });

  it("renders the move-to-project button only for the global list", () => {
    render(<ChatList userId="u1" chats={[chat]} basePath="/chats" />);
    expect(
      screen.getByRole("button", { name: `Chat „${chat.title}“ in ein Projekt verschieben` })
    ).toBeInTheDocument();
  });

  it("hides the move-to-project button inside a project's own chat list", () => {
    render(<ChatList userId="u1" chats={[chat]} basePath="/projects/p1/chats" />);
    expect(
      screen.queryByRole("button", { name: `Chat „${chat.title}“ in ein Projekt verschieben` })
    ).not.toBeInTheDocument();
  });

  it("renames a chat, returns to view mode, and refreshes", async () => {
    const chain = okWrite();
    update.mockReturnValue(chain);
    const user = userEvent.setup();
    render(<ChatList userId="u1" chats={[chat]} />);

    await user.click(screen.getByRole("button", { name: `Chat „${chat.title}“ umbenennen` }));
    const input = screen.getByLabelText("Neuer Chat-Titel");
    await user.clear(input);
    await user.type(input, "Neuer Titel{Enter}");

    expect(update).toHaveBeenCalledWith({ title: "Neuer Titel" });
    expect(chain.eq).toHaveBeenCalledWith("id", "chat-1");
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
    render(<ChatList userId="u1" chats={[chat]} />);

    await user.click(screen.getByRole("button", { name: `Chat „${chat.title}“ umbenennen` }));
    const input = screen.getByLabelText("Neuer Chat-Titel");
    await user.type(input, " geändert");
    await user.keyboard("{Escape}");

    expect(update).not.toHaveBeenCalled();
    expect(screen.getByText(chat.title)).toBeInTheDocument();
  });

  it("does not rename to an empty title", async () => {
    const user = userEvent.setup();
    render(<ChatList userId="u1" chats={[chat]} />);

    await user.click(screen.getByRole("button", { name: `Chat „${chat.title}“ umbenennen` }));
    const input = screen.getByLabelText("Neuer Chat-Titel");
    await user.clear(input);
    await user.keyboard("{Enter}");

    expect(update).not.toHaveBeenCalled();
    expect(screen.getByText(chat.title)).toBeInTheDocument();
  });

  it("shows a toast and stays in rename mode when the rename fails", async () => {
    update.mockReturnValue(failedWrite());
    const user = userEvent.setup();
    render(<ChatList userId="u1" chats={[chat]} />);

    await user.click(screen.getByRole("button", { name: `Chat „${chat.title}“ umbenennen` }));
    const input = screen.getByLabelText("Neuer Chat-Titel");
    await user.type(input, " geändert{Enter}");

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    expect(screen.getByLabelText("Neuer Chat-Titel")).toBeInTheDocument();
  });

  it("requires a confirm step before deleting", async () => {
    const user = userEvent.setup();
    render(<ChatList userId="u1" chats={[chat]} />);

    await user.click(screen.getByRole("button", { name: `Chat „${chat.title}“ löschen` }));
    expect(screen.getByText(/endgültig löschen\?/)).toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(screen.getByText(chat.title)).toBeInTheDocument();
  });

  it("deletes the chat after confirming and shows a success toast", async () => {
    const chain = okWrite();
    del.mockReturnValue(chain);
    const user = userEvent.setup();
    render(<ChatList userId="u1" chats={[chat]} />);

    await user.click(screen.getByRole("button", { name: `Chat „${chat.title}“ löschen` }));
    await user.click(screen.getByRole("button", { name: "Löschen" }));

    expect(chain.eq).toHaveBeenCalledWith("id", "chat-1");
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an error toast and does not refresh when delete fails", async () => {
    del.mockReturnValue(failedWrite());
    const user = userEvent.setup();
    render(<ChatList userId="u1" chats={[chat]} />);

    await user.click(screen.getByRole("button", { name: `Chat „${chat.title}“ löschen` }));
    await user.click(screen.getByRole("button", { name: "Löschen" }));

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    expect(refresh).not.toHaveBeenCalled();
  });

  // Fotos und Dateien (2026-10-02): die Zeilen der Anhaenge gehen per Kaskade
  // mit dem Chat, die Objekte im Bucket nicht. Genau dafuer ist dieser Schritt.
  describe("attachments of a deleted chat", () => {
    async function deleteChat() {
      const user = userEvent.setup();
      render(<ChatList userId="u1" chats={[chat]} />);
      await user.click(screen.getByRole("button", { name: `Chat „${chat.title}“ löschen` }));
      await user.click(screen.getByRole("button", { name: "Löschen" }));
    }

    it("removes the objects of the chat's attachments once the chat is gone", async () => {
      attachmentRange.mockResolvedValue({
        data: [{ storage_path: "u1/chat-1/a.png" }, { storage_path: "u1/chat-1/b.txt" }],
        error: null,
      });

      await deleteChat();

      await waitFor(() =>
        expect(storageRemove).toHaveBeenCalledWith("chat-attachments", [
          "u1/chat-1/a.png",
          "u1/chat-1/b.txt",
        ])
      );
    });

    it("makes no removal call for a chat without attachments", async () => {
      await deleteChat();
      await waitFor(() => expect(toast).toHaveBeenCalled());
      expect(storageRemove).not.toHaveBeenCalled();
    });

    // Schlaegt das Loeschen fehl, stehen die Zeilen noch und zeigen auf die Dateien.
    it("keeps the objects when the chat itself could not be deleted", async () => {
      attachmentRange.mockResolvedValue({ data: [{ storage_path: "u1/chat-1/a.png" }], error: null });
      del.mockReturnValue(failedWrite());

      await deleteChat();

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }))
      );
      expect(storageRemove).not.toHaveBeenCalled();
    });

    it("still deletes the chat when its attachments cannot be listed", async () => {
      attachmentRange.mockResolvedValue({ data: null, error: new Error("relation does not exist") });

      await deleteChat();

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }))
      );
    });

    it("still reports success when removing the objects fails, they are only orphans then", async () => {
      attachmentRange.mockResolvedValue({ data: [{ storage_path: "u1/chat-1/a.png" }], error: null });
      storageRemove.mockRejectedValue(new Error("storage down"));

      await deleteChat();

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }))
      );
    });
  });
});
