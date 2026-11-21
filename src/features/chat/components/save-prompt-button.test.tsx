import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SavePromptButton } from "./save-prompt-button";

const refresh = vi.fn();
const getUser = vi.fn();
const insert = vi.fn();
const update = vi.fn();
const updateFilters = vi.fn();
const written = vi.fn();
const toast = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/shared/ui/toast", () => ({
  useToast: () => ({ toast }),
}));

// insert(...).select() und update(...).eq().eq().select() enden beide in `written`, dem Ergebnis der Datenbank.
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser },
    from: () => ({
      insert: (row: unknown) => {
        insert(row);
        return { select: written };
      },
      update: (row: unknown) => {
        update(row);
        const chain = {
          eq: (column: string, value: unknown) => {
            updateFilters(column, value);
            return chain;
          },
          select: written,
        };
        return chain;
      },
    }),
  }),
}));

const target = { id: "prompt-7", title: "Brief an Anna", prompt: "Alte Fassung." };

describe("SavePromptButton", () => {
  beforeEach(() => {
    refresh.mockReset();
    getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
    insert.mockReset();
    update.mockReset();
    updateFilters.mockReset();
    written.mockReset().mockResolvedValue({ data: [{ id: "neu" }], error: null });
    toast.mockReset();
  });

  it("saves the prompt and switches to the saved state", async () => {
    render(<SavePromptButton projectId="p1" conversationId="c1" prompt="Du bist ein Tutor." />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("button", { name: "Gespeichert" })).toBeDisabled();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "p1",
        conversation_id: "c1",
        user_id: "user-1",
        outputs: expect.objectContaining({ prompt: "Du bist ein Tutor." }),
      })
    );
    expect(update).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  // QA finding F-7: saving used to re-arm after 2.5s, so the same prompt
  // could be saved arbitrarily often. It must now stay disabled for good.
  it("does not re-arm after saving (no duplicate saves)", async () => {
    render(<SavePromptButton projectId="p1" prompt="Du bist ein Tutor." />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Speichern" }));
    await screen.findByRole("button", { name: "Gespeichert" });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Gespeichert" })).toBeDisabled();
  });

  // The dedup check itself lives in chat-result-panel.tsx (extractSavedPromptContents
  // + savedPrompts prop); this pins the button's own contract with that check.
  it("starts disabled in the saved state when initiallySaved is true", () => {
    render(<SavePromptButton projectId="p1" prompt="Schon gespeichert." initiallySaved versionTarget={target} />);
    expect(screen.getByRole("button", { name: "Gespeichert" })).toBeDisabled();
    expect(insert).not.toHaveBeenCalled();
  });

  // QA finding N-1: saving is project-independent now — a global chat has
  // no projectId at all, not even an empty string, and must still save.
  it("saves with project_id and conversation_id null when both are omitted (a global chat)", async () => {
    render(<SavePromptButton prompt="Du bist ein Tutor." />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("button", { name: "Gespeichert" })).toBeDisabled();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: null, conversation_id: null, user_id: "user-1" })
    );
  });

  it("shows an error toast and stays saveable when the insert fails", async () => {
    written.mockResolvedValue({ data: null, error: { message: "db down" } });
    render(<SavePromptButton projectId="p1" prompt="Du bist ein Tutor." />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("button", { name: "Speichern" })).not.toBeDisabled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
  });

  describe("mit einem Kandidaten für eine neue Version", () => {
    it("klappt zwei Wege auf und speichert als neue Version des Kandidaten, mit dessen Titel", async () => {
      render(<SavePromptButton projectId="p1" conversationId="c1" prompt="Neue Fassung." versionTarget={target} />);
      const user = userEvent.setup();
      const toggle = screen.getByRole("button", { name: "Speichern" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      await user.click(screen.getByRole("button", { name: /Als neue Version/ }));

      expect(await screen.findByRole("button", { name: "Gespeichert" })).toBeDisabled();
      expect(update).toHaveBeenCalledWith({ outputs: { prompt: "Neue Fassung.", title: "Brief an Anna" } });
      expect(updateFilters).toHaveBeenCalledWith("id", "prompt-7");
      expect(updateFilters).toHaveBeenCalledWith("user_id", "user-1");
      expect(insert).not.toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Neue Version von „Brief an Anna“ gespeichert", variant: "success" })
      );
    });

    it("legt auf Wunsch einen neuen Prompt an und vermerkt den Chat", async () => {
      render(<SavePromptButton conversationId="c1" prompt="Neue Fassung." versionTarget={target} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Speichern" }));
      await user.click(screen.getByRole("button", { name: /Als neuen Prompt/ }));

      await screen.findByRole("button", { name: "Gespeichert" });
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ conversation_id: "c1", user_id: "user-1" }));
      expect(update).not.toHaveBeenCalled();
    });

    it("bietet keine Version an, wenn der Text dem Kandidaten gleicht", async () => {
      render(<SavePromptButton prompt="Alte Fassung." versionTarget={target} />);
      const button = screen.getByRole("button", { name: "Speichern" });
      expect(button).not.toHaveAttribute("aria-expanded");
      await userEvent.setup().click(button);
      await screen.findByRole("button", { name: "Gespeichert" });
      expect(insert).toHaveBeenCalledTimes(1);
    });

    it("schliesst die Wahl mit Escape, der Fokus geht zurück an den Knopf", async () => {
      render(<SavePromptButton prompt="Neue Fassung." versionTarget={target} />);
      const user = userEvent.setup();
      const toggle = screen.getByRole("button", { name: "Speichern" });
      await user.click(toggle);
      await user.keyboard("{Escape}");
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("button", { name: /Als neue Version/ })).toBeNull();
      expect(toggle).toHaveFocus();
    });

    it("meldet einen Fehler, wenn der Kandidat inzwischen gelöscht ist (keine Zeile geändert)", async () => {
      written.mockResolvedValue({ data: [], error: null });
      render(<SavePromptButton prompt="Neue Fassung." versionTarget={target} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Speichern" }));
      await user.click(screen.getByRole("button", { name: /Als neue Version/ }));

      expect(await screen.findByRole("button", { name: "Speichern" })).not.toBeDisabled();
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    });
  });
});
