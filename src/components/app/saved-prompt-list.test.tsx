import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SavedPromptList } from "./saved-prompt-list";
import type { SavedPrompt } from "@/lib/saved-prompts";

const refresh = vi.fn();
const toast = vi.fn();
const update = vi.fn();
const del = vi.fn();
const writeText = vi.fn().mockResolvedValue(undefined);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({ update, delete: del }),
  }),
}));

const prompt: SavedPrompt = {
  id: "p1",
  title: "Alter Name",
  content: "Du bist ein hilfreicher Assistent.",
  target: "Cursor",
  createdAt: new Date().toISOString(),
};

describe("SavedPromptList", () => {
  beforeEach(() => {
    refresh.mockReset();
    toast.mockReset();
    update.mockReset();
    del.mockReset();
    writeText.mockClear();
    update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    del.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    // Deliberately not defining navigator.clipboard here: user-event's
    // clipboard interception is wired up at setup() time, so it must run
    // before navigator.clipboard is ever (re)defined, or its click
    // simulation never reaches a test's writeText mock. The one test that
    // needs it (below) does both in the right order itself.
  });

  it("renders the prompt title, content and target", () => {
    render(<SavedPromptList prompts={[prompt]} canExportPdf={false} />);
    expect(screen.getByText("Alter Name")).toBeInTheDocument();
    expect(screen.getByText("Du bist ein hilfreicher Assistent.")).toBeInTheDocument();
    expect(screen.getByText("Für Cursor")).toBeInTheDocument();
  });

  it("hides the PDF export button on Free", () => {
    render(<SavedPromptList prompts={[prompt]} canExportPdf={false} />);
    expect(screen.queryByRole("button", { name: "Als PDF exportieren" })).not.toBeInTheDocument();
  });

  it("shows the PDF export button on Pro/Team", () => {
    render(<SavedPromptList prompts={[prompt]} canExportPdf />);
    expect(screen.getByRole("button", { name: "Als PDF exportieren" })).toBeInTheDocument();
  });

  it("copies the prompt content", async () => {
    // user-event's clipboard interception is wired up at setup() time, so
    // it must run before navigator.clipboard is (re)defined below, or its
    // own click simulation never reaches this test's writeText mock.
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<SavedPromptList prompts={[prompt]} canExportPdf={false} />);
    await user.click(screen.getByRole("button", { name: /Kopieren/ }));
    expect(writeText).toHaveBeenCalledWith(prompt.content);
  });

  // QA finding N-1: naming is the point of a saved-prompt library
  // ("sessionStartPrompt"), so a saved prompt must be renameable.
  describe("renaming", () => {
    it("renames the prompt, reconstructing the outputs JSONB, and refreshes", async () => {
      const eq = vi.fn().mockResolvedValue({ error: null });
      update.mockReturnValue({ eq });
      const user = userEvent.setup();
      render(<SavedPromptList prompts={[prompt]} canExportPdf={false} />);

      await user.click(screen.getByRole("button", { name: "„Alter Name“ umbenennen" }));
      const input = screen.getByLabelText("Neuer Name für den Prompt");
      await user.clear(input);
      await user.type(input, "sessionStartPrompt{Enter}");

      expect(update).toHaveBeenCalledWith({
        outputs: { prompt: prompt.content, title: "sessionStartPrompt", target: "Cursor" },
      });
      expect(eq).toHaveBeenCalledWith("id", "p1");
      expect(refresh).toHaveBeenCalled();
      // The list re-renders with the new title from local state, without
      // waiting on the server refresh to reflect it.
      expect(await screen.findByText("sessionStartPrompt")).toBeInTheDocument();
    });

    it("omits target from the reconstructed outputs when the prompt has none", async () => {
      const eq = vi.fn().mockResolvedValue({ error: null });
      update.mockReturnValue({ eq });
      const untargeted: SavedPrompt = { ...prompt, target: null };
      const user = userEvent.setup();
      render(<SavedPromptList prompts={[untargeted]} canExportPdf={false} />);

      await user.click(screen.getByRole("button", { name: "„Alter Name“ umbenennen" }));
      await user.type(screen.getByLabelText("Neuer Name für den Prompt"), " v2{Enter}");

      expect(update).toHaveBeenCalledWith({
        outputs: { prompt: prompt.content, title: "Alter Name v2" },
      });
    });

    it("cancels on Escape without calling Supabase", async () => {
      const user = userEvent.setup();
      render(<SavedPromptList prompts={[prompt]} canExportPdf={false} />);

      await user.click(screen.getByRole("button", { name: "„Alter Name“ umbenennen" }));
      await user.type(screen.getByLabelText("Neuer Name für den Prompt"), " geändert");
      await user.keyboard("{Escape}");

      expect(update).not.toHaveBeenCalled();
      expect(screen.getByText("Alter Name")).toBeInTheDocument();
    });

    it("does not rename to an empty title", async () => {
      const user = userEvent.setup();
      render(<SavedPromptList prompts={[prompt]} canExportPdf={false} />);

      await user.click(screen.getByRole("button", { name: "„Alter Name“ umbenennen" }));
      await user.clear(screen.getByLabelText("Neuer Name für den Prompt"));
      await user.keyboard("{Enter}");

      expect(update).not.toHaveBeenCalled();
      expect(screen.getByText("Alter Name")).toBeInTheDocument();
    });

    it("shows a toast and stays in rename mode when the update fails", async () => {
      update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: "fail" } }) });
      const user = userEvent.setup();
      render(<SavedPromptList prompts={[prompt]} canExportPdf={false} />);

      await user.click(screen.getByRole("button", { name: "„Alter Name“ umbenennen" }));
      await user.type(screen.getByLabelText("Neuer Name für den Prompt"), " v2{Enter}");

      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
      expect(screen.getByLabelText("Neuer Name für den Prompt")).toBeInTheDocument();
    });
  });

  describe("deleting", () => {
    it("deletes the prompt and shows a success toast", async () => {
      const eq = vi.fn().mockResolvedValue({ error: null });
      del.mockReturnValue({ eq });
      const user = userEvent.setup();
      render(<SavedPromptList prompts={[prompt]} canExportPdf={false} />);

      await user.click(screen.getByRole("button", { name: "Prompt löschen" }));

      expect(eq).toHaveBeenCalledWith("id", "p1");
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
      expect(refresh).toHaveBeenCalled();
      expect(screen.queryByText("Alter Name")).not.toBeInTheDocument();
    });

    it("shows an error toast and keeps the prompt listed when delete fails", async () => {
      del.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: "fail" } }) });
      const user = userEvent.setup();
      render(<SavedPromptList prompts={[prompt]} canExportPdf={false} />);

      await user.click(screen.getByRole("button", { name: "Prompt löschen" }));

      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
      expect(screen.getByText("Alter Name")).toBeInTheDocument();
    });
  });
});
