import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// Die Karte liest beim Aufklappen den Verlauf (saved_prompt_versions) und den Stand der Freigabe über
// /api/prompts/<id>/share (fetch); nach diesem Stand prüfen Bearbeiten und Wiederherstellen.
let versionRows: { version: number; content: string; created_at: string }[] = [];
function readChain(result: () => unknown) {
  const chain = {
    eq: () => chain,
    order: () => chain,
    range: async () => result(),
  };
  return chain;
}
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) =>
      table === "saved_prompt_versions"
        ? {
            select: () =>
              readChain(() => ({
                data: [...versionRows].sort((a, b) => b.version - a.version),
                error: null,
                count: versionRows.length,
              })),
          }
        : { update, delete: del },
  }),
}));

const TOKEN = "abcdefghijABCDEFGHIJ0123456789_-";
const fetchMock = vi.fn();
const shareAnswer = (token: string | null, ok = true) =>
  Promise.resolve({ ok, json: async () => ({ token }) } as Response);

/** update().eq().eq().select("id"): die Zeile ist geschrieben. */
function writtenRow() {
  const chain = { eq: () => chain, select: async () => ({ data: [{ id: "p1" }], error: null }) };
  return chain;
}

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
    versionRows = [{ version: 1, content: prompt.content, created_at: prompt.createdAt }];
    // Vorgabe: nicht geteilt.
    fetchMock.mockReset().mockImplementation(() => shareAnswer(null));
    vi.stubGlobal("fetch", fetchMock);
    // Deliberately not defining navigator.clipboard here: user-event's
    // clipboard interception is wired up at setup() time, so it must run
    // before navigator.clipboard is ever (re)defined, or its click
    // simulation never reaches a test's writeText mock. The one test that
    // needs it (below) does both in the right order itself.
  });
  afterEach(() => vi.unstubAllGlobals());

  describe("list of titles", () => {
    it("shows only the title while closed", () => {
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);
      expect(screen.getByRole("button", { name: "Alter Name" })).toHaveAttribute(
        "aria-expanded",
        "false"
      );
      expect(screen.queryByText("Du bist ein hilfreicher Assistent.")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Kopieren/ })).not.toBeInTheDocument();
    });

    it("opens the prompt on click and closes it again", async () => {
      const user = userEvent.setup();
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);

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
      render(<SavedPromptList userId="u1" prompts={[prompt, second]} />);

      await openPrompt(user, "Zweiter");
      expect(screen.getByText("Zweiter Text.")).toBeInTheDocument();
      expect(screen.queryByText("Du bist ein hilfreicher Assistent.")).not.toBeInTheDocument();
    });
  });

  it("shows the PDF export button for every account", async () => {
    const user = userEvent.setup();
    render(<SavedPromptList userId="u1" prompts={[prompt]} />);
    await openPrompt(user);
    expect(screen.getByRole("button", { name: "Als PDF exportieren" })).toBeInTheDocument();
  });

  it("copies the prompt content", async () => {
    // user-event's clipboard interception is wired up at setup() time, so
    // it must run before navigator.clipboard is (re)defined below, or its
    // own click simulation never reaches this test's writeText mock.
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<SavedPromptList userId="u1" prompts={[prompt]} />);
    await openPrompt(user);
    await user.click(screen.getByRole("button", { name: /Kopieren/ }));
    expect(writeText).toHaveBeenCalledWith(prompt.content);
  });

  describe("filling in placeholders", () => {
    const template: SavedPrompt = {
      ...prompt,
      id: "p3",
      title: "Brief",
      content: "Schreib an [Name des Vermieters] wegen [Thema]. Unterschrift: [dein Name]",
    };

    it("offers the chat's form, with a hint that does not mention the test run", async () => {
      const user = userEvent.setup();
      render(<SavedPromptList userId="u1" prompts={[template]} />);
      await openPrompt(user, "Brief");

      await user.click(screen.getByRole("button", { name: "Platzhalter ausfüllen (3)" }));
      expect(screen.getByText(/Gespeichert bleibt der Prompt mit seinen Platzhaltern/)).toBeInTheDocument();
      expect(screen.queryByText(/Probelauf/)).not.toBeInTheDocument();

      await user.type(screen.getByLabelText("Name des Vermieters"), "Frau Muster");
      expect(screen.getByText("Schreib an Frau Muster wegen [Thema]. Unterschrift: [dein Name]")).toBeInTheDocument();
    });

    it("copies the filled-in version from the form and keeps the saved text in the bar", async () => {
      const user = userEvent.setup();
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      render(<SavedPromptList userId="u1" prompts={[template]} />);
      await openPrompt(user, "Brief");
      await user.click(screen.getByRole("button", { name: "Platzhalter ausfüllen (3)" }));
      await user.type(screen.getByLabelText("Thema"), "Heizung");

      await user.click(screen.getByRole("button", { name: "Ausgefüllt kopieren" }));
      expect(writeText).toHaveBeenLastCalledWith("Schreib an [Name des Vermieters] wegen Heizung. Unterschrift: [dein Name]");
      await user.click(screen.getByRole("button", { name: "Kopieren" }));
      expect(writeText).toHaveBeenLastCalledWith(template.content);
    });

    it("hands what is filled in to the developer export", async () => {
      const user = userEvent.setup();
      render(<SavedPromptList userId="u1" prompts={[template]} />);
      await openPrompt(user, "Brief");
      await user.click(screen.getByRole("button", { name: "Platzhalter ausfüllen (3)" }));
      await user.type(screen.getByLabelText("Thema"), "Heizung");
      await user.click(screen.getByRole("button", { name: "„dein Name“ nicht als Platzhalter behandeln" }));

      await user.click(screen.getByRole("button", { name: "Für Entwickler exportieren" }));
      const body = JSON.parse(screen.getByLabelText("Vorschau des Exports").textContent!);
      expect(body.messages[0].content).toBe("Schreib an {{name_des_vermieters}} wegen Heizung. Unterschrift: [dein Name]");
    });

    it("shows no form for a prompt without placeholders", async () => {
      const user = userEvent.setup();
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);
      await openPrompt(user);
      expect(screen.queryByRole("button", { name: /Platzhalter ausfüllen/ })).not.toBeInTheDocument();
    });
  });

  // QA finding N-1: naming is the point of a saved-prompt library
  // ("sessionStartPrompt"), so a saved prompt must be renameable.
  describe("renaming", () => {
    it("renames the prompt, reconstructing the outputs JSONB, and refreshes", async () => {
      const chain = okWrite();
      update.mockReturnValue(chain);
      const user = userEvent.setup();
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);

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
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);

      await openPrompt(user);
      await user.click(screen.getByRole("button", { name: "„Alter Name“ umbenennen" }));
      await user.type(screen.getByLabelText("Neuer Name für den Prompt"), " geändert");
      await user.keyboard("{Escape}");

      expect(update).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Alter Name" })).toBeInTheDocument();
    });

    it("does not rename to an empty title", async () => {
      const user = userEvent.setup();
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);

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
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);

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
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);

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
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);

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
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);

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
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);

      await openPrompt(user);
      await user.click(screen.getByRole("button", { name: "Prompt löschen" }));
      await user.click(screen.getByRole("button", { name: "Endgültig löschen" }));

      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
      expect(screen.getByText("Alter Name")).toBeInTheDocument();
    });
  });

  describe("Versionen an der Karte", () => {
    it("zeigt den Verlauf erst ab zwei Versionen", async () => {
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);
      const user = userEvent.setup();
      await openPrompt(user);
      await waitFor(() => expect(screen.getByText(prompt.content)).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: /^Verlauf/ })).toBeNull();
    });

    it("übernimmt einen bearbeiteten Text in die Karte, der Verlauf zeigt die neue Zahl", async () => {
      versionRows = [
        { version: 1, content: "Erste Fassung.", created_at: prompt.createdAt },
        { version: 2, content: prompt.content, created_at: prompt.createdAt },
      ];
      // Bearbeiten schreibt update().eq().eq().select("id"); die dritte Version steht erst in der Datenbank, wenn die
      // Antwort ankommt (verzögert wie im Netz). Ein Nachladen davor sähe noch zwei.
      const written = {
        eq: () => written,
        select: () =>
          new Promise((resolve) =>
            setTimeout(() => {
              versionRows.push({ version: 3, content: "Neuer Text.", created_at: prompt.createdAt });
              resolve({ data: [{ id: "p1" }], error: null });
            }, 30)
          ),
      };
      update.mockReturnValue(written);
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);
      const user = userEvent.setup();
      await openPrompt(user);
      expect(await screen.findByRole("button", { name: "Verlauf (2 Versionen)" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Text von „Alter Name“ bearbeiten" }));
      const field = screen.getByLabelText("Text von „Alter Name“", { exact: true });
      await user.clear(field);
      await user.type(field, "Neuer Text.");
      await user.click(screen.getByRole("button", { name: "Als neue Version speichern" }));

      expect(update).toHaveBeenCalledWith({ outputs: { prompt: "Neuer Text.", title: "Alter Name" } });
      // Ein gesteuertes <textarea> trägt seinen Wert auch als Textknoten: ohne `selector` träfe die Suche das Feld des
      // Editors, solange er offen ist. Gemeint ist der Text der Karte, und der Editor ist dann zu.
      expect(await screen.findByText("Neuer Text.", { selector: "pre" })).toBeInTheDocument();
      expect(screen.queryByLabelText("Text von „Alter Name“", { exact: true })).toBeNull();
      expect(await screen.findByRole("button", { name: "Verlauf (3 Versionen)" })).toBeInTheDocument();
    });
  });

  // Ein geteilter Prompt steht in seiner aktuellen Fassung sofort unter dem Link. Bearbeiten und Wiederherstellen fragen
  // vor Schlüsseln und persönlichen Angaben nach, auch solange der Stand noch lädt oder sich nicht lesen liess.
  describe("geteilter Prompt", () => {
    const KEY_TEXT = "Nutze den Key sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";
    const KEY_FINDING = "Sieht nach einem Schlüssel oder Passwort aus";

    async function startEditing(user: ReturnType<typeof userEvent.setup>, text: string) {
      await user.click(screen.getByRole("button", { name: "Text von „Alter Name“ bearbeiten" }));
      const field = screen.getByLabelText("Text von „Alter Name“", { exact: true });
      await user.clear(field);
      await user.type(field, text);
    }
    const saveButton = () => screen.getByRole("button", { name: "Als neue Version speichern" });
    beforeEach(() => {
      update.mockReturnValue(writtenRow());
    });

    it("fragt nach, wenn sich der Stand der Freigabe nicht lesen liess", async () => {
      fetchMock.mockImplementation(() => shareAnswer(null, false));
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);
      const user = userEvent.setup();
      await openPrompt(user);
      expect(await screen.findByText("Ob dieser Prompt geteilt ist, konnte ich gerade nicht prüfen.")).toBeInTheDocument();

      await startEditing(user, KEY_TEXT);
      await user.click(saveButton());
      expect(update).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(KEY_FINDING);

      await user.click(screen.getByRole("button", { name: "Trotzdem speichern" }));
      expect(update).toHaveBeenCalledWith({ outputs: { prompt: KEY_TEXT, title: "Alter Name" } });
    });

    it("fragt nach, wenn Speichern vor der Antwort kommt", async () => {
      fetchMock.mockImplementation(() => new Promise(() => {}));
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);
      const user = userEvent.setup();
      await openPrompt(user);

      await startEditing(user, KEY_TEXT);
      await user.click(saveButton());
      expect(update).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(KEY_FINDING);
    });

    it("weiss nach dem Teilen in derselben Karte, dass Bearbeiten öffentlich wird", async () => {
      fetchMock.mockImplementation((_url: string, init?: RequestInit) => shareAnswer(init?.method === "POST" ? TOKEN : null));
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);
      const user = userEvent.setup();
      await openPrompt(user);
      const share = screen.getByRole("button", { name: "Per Link teilen" });
      await waitFor(() => expect(share).toBeEnabled());

      await startEditing(user, KEY_TEXT);
      await user.click(share);
      await user.click(screen.getByRole("button", { name: "Link erstellen" }));
      expect(await screen.findByText(`${window.location.origin}/geteilt/${TOKEN}`)).toBeInTheDocument();
      expect(screen.getByText("Dieser Prompt ist geteilt: die neue Fassung steht sofort unter dem Link.")).toBeInTheDocument();

      await user.click(saveButton());
      expect(update).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(KEY_FINDING);
    });

    it("stellt eine Fassung mit Schlüssel erst nach der Rückfrage wieder her", async () => {
      fetchMock.mockImplementation(() => shareAnswer(TOKEN));
      versionRows = [
        { version: 1, content: KEY_TEXT, created_at: prompt.createdAt },
        { version: 2, content: prompt.content, created_at: prompt.createdAt },
      ];
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);
      const user = userEvent.setup();
      await openPrompt(user);
      expect(await screen.findByText(`${window.location.origin}/geteilt/${TOKEN}`)).toBeInTheDocument();

      await user.click(await screen.findByRole("button", { name: "Verlauf (2 Versionen)" }));
      await user.click(screen.getByRole("button", { name: "Version 1 wiederherstellen" }));
      expect(update).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(KEY_FINDING);

      await user.click(screen.getByRole("button", { name: "Version 1 trotzdem wiederherstellen" }));
      expect(update).toHaveBeenCalledWith({ outputs: { prompt: KEY_TEXT, title: "Alter Name" } });
    });

    it("stellt bei einem nicht geteilten Prompt ohne Rückfrage wieder her", async () => {
      versionRows = [
        { version: 1, content: KEY_TEXT, created_at: prompt.createdAt },
        { version: 2, content: prompt.content, created_at: prompt.createdAt },
      ];
      render(<SavedPromptList userId="u1" prompts={[prompt]} />);
      const user = userEvent.setup();
      await openPrompt(user);
      await waitFor(() => expect(screen.getByRole("button", { name: "Per Link teilen" })).toBeEnabled());

      await user.click(await screen.findByRole("button", { name: "Verlauf (2 Versionen)" }));
      await user.click(screen.getByRole("button", { name: "Version 1 wiederherstellen" }));
      expect(update).toHaveBeenCalledWith({ outputs: { prompt: KEY_TEXT, title: "Alter Name" } });
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
