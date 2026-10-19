import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatResultPanel } from "./chat-result-panel";

const download = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/utils")>()),
  downloadFile: download,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/shared/ui/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: () => ({ insert: vi.fn() }),
  }),
}));

const PROMPT_REPLY = "Hier ist er:\n\n```text\nDu bist ein Tutor.\n```";
const QUESTION_REPLY = "Für wen ist die Präsentation, und wie lang darf sie werden?";

describe("ChatResultPanel", () => {
  it("renders the result content as markdown inside a labeled region", () => {
    render(<ChatResultPanel content={"# Produktplan\n\nEin Absatz."} />);
    expect(screen.getByRole("region", { name: "Aktuelle Antwort von Finn" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Produktplan" })).toBeInTheDocument();
    expect(screen.getByText("Ein Absatz.")).toBeInTheDocument();
  });

  // #150: die Überschrift folgt dem Inhalt. Finns Rückfrage ist kein Ergebnis.
  it("nennt eine Antwort mit Prompt-Block „Dein Prompt“", () => {
    render(<ChatResultPanel content={PROMPT_REPLY} />);
    expect(screen.getByText("Dein Prompt")).toBeInTheDocument();
    expect(screen.queryByText("Finns Antwort")).not.toBeInTheDocument();
  });

  it("nennt eine Rückfrage ohne Prompt-Block nicht „Dein Prompt“ und bietet kein Speichern an", () => {
    render(<ChatResultPanel content={QUESTION_REPLY} />);
    expect(screen.getByText("Finns Antwort")).toBeInTheDocument();
    expect(screen.queryByText("Dein Prompt")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Speichern" })).not.toBeInTheDocument();
  });

  // #150: die neueste Antwort hatte "Prompt kopieren" und "Speichern", aber keinen Export,
  // eine ältere Antwort (Blase) schon.
  it("bietet dieselben Aktionen wie eine ältere Antwort: Antwort kopieren und Export", () => {
    render(<ChatResultPanel content={PROMPT_REPLY} />);
    expect(screen.getByRole("button", { name: "Antwort kopieren" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("exportiert die Antwort als Markdown-Datei, benannt nach ihrer Stelle im Chat", async () => {
    download.mockClear();
    render(<ChatResultPanel content={PROMPT_REPLY} index={3} />);
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(download).toHaveBeenCalledExactlyOnceWith(
      "prompt-4.md",
      expect.stringContaining("Du bist ein Tutor."),
      "text/markdown"
    );
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
