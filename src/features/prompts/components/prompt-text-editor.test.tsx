import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromptTextEditor } from "./prompt-text-editor";
import type { ShareStatus } from "@/shared/lib/prompt-share-status";

const refresh = vi.fn();
const toast = vi.fn();
const update = vi.fn();
const filters = vi.fn();
const written = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));
// Der Editor schreibt nur: update().eq().eq().select("id"). Den Stand der Freigabe bekommt er von der Karte.
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => written(),
        eq: (column: string, value: unknown) => {
          filters(table, column, value);
          return chain;
        },
        update: (row: unknown) => {
          update(row);
          return chain;
        },
      };
      return chain;
    },
  }),
}));

const KEY_TEXT = "Nutze den Key sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";
const PRIVATE: ShareStatus = { status: "private" };
const SHARED: ShareStatus = { status: "shared", token: "abcdefghijABCDEFGHIJ0123456789_-" };

function editor(share: ShareStatus, onSaved = vi.fn(), onClose = vi.fn()) {
  return (
    <PromptTextEditor
      promptId="p1"
      userId="u1"
      title="Brief"
      content="Alter Text."
      share={share}
      onSaved={onSaved}
      onClose={onClose}
    />
  );
}

function renderEditor(share: ShareStatus = PRIVATE, onSaved = vi.fn(), onClose = vi.fn()) {
  const view = render(editor(share, onSaved, onClose));
  return { ...view, onSaved, onClose, field: screen.getByLabelText("Text von „Brief“") };
}

describe("PromptTextEditor", () => {
  beforeEach(() => {
    refresh.mockReset();
    toast.mockReset();
    update.mockReset();
    filters.mockReset();
    written.mockReset().mockResolvedValue({ data: [{ id: "p1" }], error: null });
  });

  it("speichert nur den Text, mit dem Titel, für die eigene Zeile", async () => {
    const { onSaved, onClose, field } = renderEditor();
    const user = userEvent.setup();
    await user.clear(field);
    await user.type(field, "Neuer Text.");
    await user.click(screen.getByRole("button", { name: "Als neue Version speichern" }));

    expect(onSaved).toHaveBeenCalledWith("Neuer Text.");
    expect(update).toHaveBeenCalledWith({ outputs: { prompt: "Neuer Text.", title: "Brief" } });
    expect(filters).toHaveBeenCalledWith("saved_prompts", "id", "p1");
    expect(filters).toHaveBeenCalledWith("saved_prompts", "user_id", "u1");
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Neue Version gespeichert", variant: "success" }));
    expect(onClose).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("lässt einen unveränderten oder leeren Text nicht speichern", async () => {
    const { field } = renderEditor();
    const save = screen.getByRole("button", { name: "Als neue Version speichern" });
    expect(save).toBeDisabled();
    expect(screen.getByText("Noch keine Änderung.")).toBeInTheDocument();
    await userEvent.setup().clear(field);
    expect(save).toBeDisabled();
  });

  it("setzt bei einem Fehler keinen Text und sagt es", async () => {
    written.mockResolvedValue({ data: null, error: { message: "nope" } });
    const { field, onClose, onSaved } = renderEditor();
    const user = userEvent.setup();
    await user.type(field, " Mehr.");
    await user.click(screen.getByRole("button", { name: "Als neue Version speichern" }));

    expect(onSaved).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  // Der Verlauf lädt bei einem neuen Text nach. Käme der Text vor dem Schreiben in die Karte, sähe er die alte Zahl.
  it("gibt den neuen Text erst weiter, wenn er geschrieben ist", async () => {
    let finish: (value: unknown) => void = () => {};
    written.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { field, onSaved } = renderEditor();
    const user = userEvent.setup();
    await user.type(field, " Mehr.");
    await user.click(screen.getByRole("button", { name: "Als neue Version speichern" }));

    expect(onSaved).not.toHaveBeenCalled();
    finish({ data: [{ id: "p1" }], error: null });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Alter Text. Mehr."));
  });

  it("schliesst mit Escape ohne zu speichern", async () => {
    const { onClose } = renderEditor();
    await userEvent.setup().keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("weist bei einem geteilten Prompt auf den Link hin und fragt bei Schlüsseln nach", async () => {
    const { field } = renderEditor(SHARED);
    expect(screen.getByText(/geteilt: die neue Fassung steht sofort unter dem Link/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.clear(field);
    await user.type(field, KEY_TEXT);
    await user.click(screen.getByRole("button", { name: "Als neue Version speichern" }));

    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Bitte prüf vorher: Sieht nach einem Schlüssel oder Passwort aus (sk-a…89)");
    await user.click(screen.getByRole("button", { name: "Trotzdem speichern" }));
    expect(update).toHaveBeenCalledTimes(1);
  });

  // Lädt der Stand noch oder liess er sich nicht lesen, kann der Prompt geteilt sein: dann gilt dieselbe Rückfrage.
  it.each<[string, ShareStatus]>([
    ["noch unterwegs", { status: "loading" }],
    ["nicht lesbar", { status: "error" }],
  ])("fragt auch nach, wenn der Stand %s ist", async (_case, share) => {
    const { field } = renderEditor(share);
    expect(screen.queryByText(/geteilt: die neue Fassung/)).toBeNull();

    const user = userEvent.setup();
    await user.clear(field);
    await user.type(field, KEY_TEXT);
    await user.click(screen.getByRole("button", { name: "Als neue Version speichern" }));

    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Sieht nach einem Schlüssel oder Passwort aus");
    await user.click(screen.getByRole("button", { name: "Trotzdem speichern" }));
    expect(update).toHaveBeenCalledWith({ outputs: { prompt: KEY_TEXT, title: "Brief" } });
  });

  it("fragt bei einem privaten Prompt nicht nach", async () => {
    const { field } = renderEditor(PRIVATE);
    const user = userEvent.setup();
    await user.clear(field);
    await user.type(field, KEY_TEXT);
    await user.click(screen.getByRole("button", { name: "Als neue Version speichern" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(update).toHaveBeenCalledWith({ outputs: { prompt: KEY_TEXT, title: "Brief" } });
  });

  // "Trotzdem" bestätigt nur, was die Rückfrage zeigt: meldet die Karte inzwischen "privat", ist sie weg, und Speichern
  // ist wieder ein gewöhnliches Speichern.
  it("lässt die Rückfrage fallen, wenn der Stand inzwischen privat ist", async () => {
    const view = renderEditor({ status: "loading" });
    const user = userEvent.setup();
    await user.clear(view.field);
    await user.type(view.field, KEY_TEXT);
    await user.click(screen.getByRole("button", { name: "Als neue Version speichern" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    view.rerender(editor(PRIVATE, view.onSaved, view.onClose));
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Als neue Version speichern" }));
    expect(update).toHaveBeenCalledWith({ outputs: { prompt: KEY_TEXT, title: "Brief" } });
  });
});
