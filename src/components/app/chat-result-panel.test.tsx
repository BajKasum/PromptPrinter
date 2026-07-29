import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatResultPanel } from "./chat-result-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: () => ({ insert: vi.fn() }),
  }),
}));

describe("ChatResultPanel", () => {
  it("renders the result content as markdown inside a labeled region", () => {
    render(<ChatResultPanel content={"# Produktplan\n\nEin Absatz."} />);
    expect(screen.getByRole("region", { name: "Aktuelles Ergebnis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Produktplan" })).toBeInTheDocument();
    expect(screen.getByText("Ein Absatz.")).toBeInTheDocument();
  });

  // QA finding F-7: a prompt already saved in this project must not offer a
  // fresh "Speichern" affordance, the button should start disabled/"Gespeichert".
  it("starts the save button disabled when the prompt is already saved", () => {
    const content = "```text\nDu bist ein Tutor.\n```";
    render(
      <ChatResultPanel
        content={content}
        projectId="p1"
        savedPrompts={["Du bist ein Tutor."]}
      />
    );
    expect(screen.getByRole("button", { name: "Gespeichert" })).toBeDisabled();
  });

  it("keeps the save button active when the prompt is not among the saved ones", () => {
    const content = "```text\nEin neuer Prompt.\n```";
    render(
      <ChatResultPanel
        content={content}
        projectId="p1"
        savedPrompts={["Ein anderer Prompt."]}
      />
    );
    expect(screen.getByRole("button", { name: "Speichern" })).not.toBeDisabled();
  });

  // QA finding N-1: saving used to require a project — a global chat (no
  // projectId at all) had nowhere to save into. Saved prompts are their own,
  // project-independent library now (see save-prompt-button.tsx), so the
  // button must show up here too.
  it("offers the save button in a global chat, with no projectId at all", () => {
    const content = "```text\nEin globaler Prompt.\n```";
    render(<ChatResultPanel content={content} />);
    expect(screen.getByRole("button", { name: "Speichern" })).toBeInTheDocument();
  });
});
