import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { okWrite, failedWrite } from "@tests/support/supabase-query";
import { SavedPromptList } from "./saved-prompt-list";
import type { SavedPrompt } from "@/shared/lib/saved-prompts";

const refresh = vi.fn();
const toast = vi.fn();
const update = vi.fn();
const del = vi.fn();
const writeText = vi.fn().mockResolvedValue(undefined);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/shared/ui/toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    from: () => ({ update, delete: del }),
  }),
}));

const prompt: SavedPrompt = {
  id: "p1",
  title: "Alter Name",
  content: "Du bist ein hilfreicher Assistent.",
  createdAt: new Date().toISOString(),
};

// Seit 23.09.2026 eine Titelliste: zugeklappt nur der Name, ein Klick klappt
// den Prompt samt Aktionen auf.
async function openPrompt(user: ReturnType<typeof userEvent.setup>, name = "Alter Name") {
  await user.click(screen.getByRole("button", { name }));
}

describe("SavedPromptList", () => {
  beforeEach(() => {
    refresh.mockReset();
    toast.mockReset();
    update.mockReset();
    del.mockReset();
    writeText.mockClear();
    update.mockReturnValue(okWrite());
    del.mockReturnValue(okWrite());
    // Deliberately not defining navigator.clipboard here: user-event's
    // clipboard interception is wired up at setup() time, so it must run
    // before navigator.clipboard is ever (re)defined, or its click
    // simulation never reaches a test's writeText mock. The one test that
    // needs it (below) does both in the right order itself.
  });

  describe("list of titles", () => {
    it("shows only the title while closed", () => {
      render(<SavedPromptList userId="u1" prompts={[prompt]} canExportPdf={false} />);
      expect(screen.getByRole("button", { name: "Alter Name" })).toHaveAttribute(
        "aria-expanded",
        "false"
      );
      expect(screen.queryByText("Du bist ein hilfreicher Assistent.")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Kopieren/ })).not.toBeInTheDocument();
    });

    it("opens the prompt on click and closes it again", async () => {
      const user = userEvent.setup();
      render(<SavedPromptList userId="u1" prompts={[prompt]} canExportPdf={false} />);

      await openPrompt(user);
      expect(screen.getByRole("button", { name: "Alter Name" })).toHaveAttribute(
        "aria-expanded",
        "true"
      );
      expect(screen.getByText("Du bist ein hilfreicher Assistent.")).toBeInTheDocument();

      await openPrompt(user);
      expect(screen.queryByText("Du bist ein hilfreicher Assistent.")).not.toBeInTheDocument();
    });

    it("opens each prompt on its own", async () => {
      const user = userEvent.setup();
      const second: SavedPrompt = { ...prompt, id: "p2", title: "Zweiter", content: "Zweiter Text." };
      render(<SavedPromptList userId="u1" prompts={[prompt, second]} canExportPdf={false} />);

      await openPrompt(user, "Zweiter");
      expect(screen.getByText("Zweiter Text.")).toBeInTheDocument();
      expect(screen.queryByText("Du bist ein hilfreicher Assistent.")).not.toBeInTheDocument();
    });
  });

  it("hides the PDF export button on Free", async () => {
    const user = userEvent.setup();
    render(<SavedPromptList userId="u1" prompts={[prompt]} canExportPdf={false} />);
    await openPrompt(user);
    expect(screen.queryByRole("button", { name: "Als PDF exportieren" })).not.toBeInTheDocument();
  });

  it("shows the PDF export button on Pro/Team", async () => {
    const user = userEvent.setup();
    render(<SavedPromptList userId="u1" prompts={[prompt]} canExportPdf />);
    await openPrompt(user);
    expect(screen.getByRole("button", { name: "Als PDF exportieren" })).toBeInTheDocument();
  });

  it("copies the prompt content", async () => {
    // user-event's clipboard interception is wired up at setup() time, so
    // it must run before navigator.clipboard is (re)defined below, or its
    // own click simulation never reaches this test's writeText mock.
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<SavedPromptList userId="u1" prompts={[prompt]} canExportPdf={false} />);
    await openPrompt(user);
    await user.click(screen.getByRole("button", { name: /Kopieren/ }));
    expect(writeText).toHaveBeenCalledWith(prompt.content);
  });

  // QA finding N-1: naming is the point of a saved-prompt library
  // ("sessionStartPrompt"), so a saved prompt must be renameable.
  describe("renaming", () => {
    it("renames the prompt, reconstructing the outputs JSONB, and refreshes", async () => {
      const chain = okWrite();
      update.mockReturnValue(chain);
      const user = userEvent.setup();
      render(<SavedPromptList userId="u1" prompts={[prompt]} canExportPdf={false} />);

      await openPrompt(user);
      await user.click(screen.getByRole("button", { name: "„Alter Name“ umbenennen" }));
      const input = screen.getByLabelText("Neuer Name für den Prompt");
      await user.clear(input);
      await user.type(input, "sessionStartPrompt{Enter}");

      expect(update).toHaveBeenCalledWith({
        outputs: { prompt: prompt.content, title: "sessionStartPrompt" },
      });
      expect(chain.eq).toHaveBeenCalledWith("id", "p1");
      expect(refresh).toHaveBeenCalled();
      // The list re-renders with the new title from local state, without
      // waiting on the server refresh to reflect it.
      expect(await screen.findByRole("button", { name: "sessionStartPrompt" })).toBeInTheDocument();
    });

    it("cancels on Escape without calling Supabase", async () => {
      const user = userEvent.setup();
      render(<SavedPromptList userId="u1" prompts={[prompt]} canExportPdf={false} />);

      await openPrompt(user);
      await user.click(screen.getByRole("button", { name: "„Alter Name“ umbenennen" }));
      await user.type(screen.getByLabelText("Neuer Name für den Prompt"), " geändert");
      await user.keyboard("{Escape}");

      expect(update).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Alter Name" })).toBeInTheDocument();
    });

    it("does not rename to an empty title", async () => {
      const user = userEvent.setup();
      render(<SavedPromptList userId="u1" prompts={[prompt]} canExportPdf={false} />);

      await openPrompt(user);
      await user.click(screen.getByRole("button", { name: "„Alter Name“ umbenennen" }));
      await user.clear(screen.getByLabelText("Neuer Name für den Prompt"));
      await user.keyboard("{Enter}");

      expect(update).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Alter Name" })).toBeInTheDocument();
    });

    it("shows a toast and stays in rename mode when the update fails", async () => {
      update.mockReturnValue(failedWrite());
      const user = userEvent.setup();
      render(<SavedPromptList userId="u1" prompts={[prompt]} canExportPdf={false} />);

      await openPrompt(user);
      await user.click(screen.getByRole("button", { name: "„Alter Name“ umbenennen" }));
      await user.type(screen.getByLabelText("Neuer Name für den Prompt"), " v2{Enter}");

      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
      expect(screen.getByLabelText("Neuer Name für den Prompt")).toBeInTheDocument();
    });
  });

  // K-6 (Audit 06.09.2026): ein Klick auf das Loesch-Icon entfernte den
  // Prompt bisher sofort, ohne Rueckfrage und ohne Undo — live ausgeloest.
  // Projekt, Datei und Gedaechtnis fragen alle ueber dieselbe ConfirmDialog
  // nach, hier fehlte sie.
  describe("deleting", () => {
    it("does not delete on the first click, only after confirming", async () => {
      const chain = okWrite();
      del.mockReturnValue(chain);
      const user = userEvent.setup();
      render(<SavedPromptList userId="u1" prompts={[prompt]} canExportPdf={false} />);

      await openPrompt(user);
      await user.click(screen.getByRole("button", { name: "Prompt löschen" }));

      expect(del).not.toHaveBeenCalled();
      expect(screen.getByText("Alter Name")).toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: "Prompt löschen?" })).toBeInTheDocument();
    });

    it("does nothing when the confirmation is cancelled", async () => {
      const chain = okWrite();
      del.mockReturnValue(chain);
      const user = userEvent.setup();
      render(<SavedPromptList userId="u1" prompts={[prompt]} canExportPdf={false} />);

      await openPrompt(user);
      await user.click(screen.getByRole("button", { name: "Prompt löschen" }));
      await user.click(screen.getByRole("button", { name: "Abbrechen" }));

      // AnimatePresence fades the dialog out rather than removing it instantly.
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(del).not.toHaveBeenCalled();
      expect(screen.getByText("Alter Name")).toBeInTheDocument();
    });

    it("deletes the prompt and shows a success toast once confirmed", async () => {
      const chain = okWrite();
      del.mockReturnValue(chain);
      const user = userEvent.setup();
      render(<SavedPromptList userId="u1" prompts={[prompt]} canExportPdf={false} />);

      await openPrompt(user);
      await user.click(screen.getByRole("button", { name: "Prompt löschen" }));
      await user.click(screen.getByRole("button", { name: "Endgültig löschen" }));

      expect(chain.eq).toHaveBeenCalledWith("id", "p1");
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
      expect(refresh).toHaveBeenCalled();
      expect(screen.queryByText("Alter Name")).not.toBeInTheDocument();
    });

    it("shows an error toast and keeps the prompt listed when delete fails", async () => {
      del.mockReturnValue(failedWrite());
      const user = userEvent.setup();
      render(<SavedPromptList userId="u1" prompts={[prompt]} canExportPdf={false} />);

      await openPrompt(user);
      await user.click(screen.getByRole("button", { name: "Prompt löschen" }));
      await user.click(screen.getByRole("button", { name: "Endgültig löschen" }));

      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
      expect(screen.getByText("Alter Name")).toBeInTheDocument();
    });
  });
});
