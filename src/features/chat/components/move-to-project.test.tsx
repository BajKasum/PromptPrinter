import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { okWrite, failedWrite } from "@tests/support/supabase-query";
import { MoveToProjectButton } from "./move-to-project";

const refresh = vi.fn();
const toast = vi.fn();
const select = vi.fn();
const update = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/shared/ui/toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select,
      update,
    }),
  }),
}));

describe("MoveToProjectButton", () => {
  beforeEach(() => {
    refresh.mockReset();
    toast.mockReset();
    select.mockReset();
    update.mockReset();
    select.mockReturnValue({
      order: () => ({
        limit: vi.fn().mockResolvedValue({
          data: [
            { id: "proj-1", name: "Alpha" },
            { id: "proj-2", name: "Beta" },
          ],
        }),
      }),
    });
    update.mockReturnValue(okWrite());
  });

  it("lazy-loads the project list only when opened", async () => {
    const user = userEvent.setup();
    render(<MoveToProjectButton userId="u1" chatId="chat-1" chatTitle="Mein Chat" />);
    expect(select).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Chat „Mein Chat“ in ein Projekt verschieben" })
    );
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("shows an empty-state hint when no project exists yet", async () => {
    select.mockReturnValue({
      order: () => ({ limit: vi.fn().mockResolvedValue({ data: [] }) }),
    });
    const user = userEvent.setup();
    render(<MoveToProjectButton userId="u1" chatId="chat-1" chatTitle="Mein Chat" />);
    await user.click(
      screen.getByRole("button", { name: "Chat „Mein Chat“ in ein Projekt verschieben" })
    );
    expect(await screen.findByText(/Noch kein Projekt angelegt/)).toBeInTheDocument();
  });

  it("moves the chat into the picked project and shows a success toast", async () => {
    const chain = okWrite();
    update.mockReturnValue(chain);
    const user = userEvent.setup();
    render(<MoveToProjectButton userId="u1" chatId="chat-1" chatTitle="Mein Chat" />);
    await user.click(
      screen.getByRole("button", { name: "Chat „Mein Chat“ in ein Projekt verschieben" })
    );
    await user.click(await screen.findByText("Beta"));

    expect(update).toHaveBeenCalledWith({ project_id: "proj-2" });
    expect(chain.eq).toHaveBeenCalledWith("id", "chat-1");
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });

  it("shows an error toast and keeps the menu open when the move fails", async () => {
    update.mockReturnValue(failedWrite());
    const user = userEvent.setup();
    render(<MoveToProjectButton userId="u1" chatId="chat-1" chatTitle="Mein Chat" />);
    await user.click(
      screen.getByRole("button", { name: "Chat „Mein Chat“ in ein Projekt verschieben" })
    );
    await user.click(await screen.findByText("Alpha"));

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    expect(refresh).not.toHaveBeenCalled();
  });
});
