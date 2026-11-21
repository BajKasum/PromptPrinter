import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromptTextEditor } from "./prompt-text-editor";

const refresh = vi.fn();
const toast = vi.fn();
const update = vi.fn();
const filters = vi.fn();
const written = vi.fn();
let shareRow: unknown = null;

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => (table === "saved_prompts" ? written() : chain),
        eq: (column: string, value: unknown) => {
          filters(table, column, value);
          return chain;
        },
        maybeSingle: async () => ({ data: shareRow, error: null }),
        update: (row: unknown) => {
          update(row);
          return chain;
        },
      };
      return chain;
    },
  }),
}));

function renderEditor(onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <PromptTextEditor promptId="p1" userId="u1" title="Brief" content="Alter Text." onSaved={onSaved} onClose={onClose} />
  );
  return { onSaved, onClose, field: screen.getByLabelText("Text von „Brief“") };
}

describe("PromptTextEditor", () => {
  beforeEach(() => {
    refresh.mockReset();
    toast.mockReset();
    update.mockReset();
    filters.mockReset();
    written.mockReset().mockResolvedValue({ data: [{ id: "p1" }], error: null });
    shareRow = null;
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
    shareRow = { prompt_id: "p1" };
    const { field } = renderEditor();
    expect(await screen.findByText(/geteilt: die neue Fassung steht sofort unter dem Link/)).toBeInTheDocument();
    expect(filters).toHaveBeenCalledWith("prompt_shares", "user_id", "u1");

    const user = userEvent.setup();
    await user.clear(field);
    await user.type(field, "Nutze den Key sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789");
    await user.click(screen.getByRole("button", { name: "Als neue Version speichern" }));

    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Trotzdem speichern" }));
    expect(update).toHaveBeenCalledTimes(1);
  });
});
