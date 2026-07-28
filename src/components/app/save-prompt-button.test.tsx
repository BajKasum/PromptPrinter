import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SavePromptButton } from "./save-prompt-button";

const refresh = vi.fn();
const getUser = vi.fn();
const insert = vi.fn();
const toast = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser },
    from: () => ({ insert }),
  }),
}));

describe("SavePromptButton", () => {
  beforeEach(() => {
    refresh.mockReset();
    getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
    insert.mockReset().mockResolvedValue({ error: null });
    toast.mockReset();
  });

  it("saves the prompt and switches to the saved state", async () => {
    render(<SavePromptButton projectId="p1" prompt="Du bist ein Tutor." />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("button", { name: "Gespeichert" })).toBeDisabled();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "p1",
        user_id: "user-1",
        outputs: expect.objectContaining({ prompt: "Du bist ein Tutor." }),
      })
    );
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
    render(<SavePromptButton projectId="p1" prompt="Schon gespeichert." initiallySaved />);
    expect(screen.getByRole("button", { name: "Gespeichert" })).toBeDisabled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("shows an error toast and stays saveable when the insert fails", async () => {
    insert.mockResolvedValue({ error: { message: "db down" } });
    render(<SavePromptButton projectId="p1" prompt="Du bist ein Tutor." />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("button", { name: "Speichern" })).not.toBeDisabled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
  });
});
