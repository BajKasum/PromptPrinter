import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./confirm-dialog";
import { de } from "@/shared/i18n/messages/de";

// Die Rückfrage: Fokus auf "Abbrechen", Tab bleibt darin, und während der laufenden Aktion schliesst nichts (#368).

function Harness({ busy = false, onCancel }: { busy?: boolean; onCancel?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Auslöser</button>
      <ConfirmDialog
        open={open}
        title="Löschen?"
        // Ein Link vor den Knöpfen, wie bei der Einwilligung zum Sprachmodus.
        description={<a href="/datenschutz">Unumkehrbar.</a>}
        confirmLabel="Weg damit"
        busyLabel="Läuft"
        busy={busy}
        onConfirm={() => {}}
        onCancel={() => {
          onCancel?.();
          setOpen(false);
        }}
      />
    </>
  );
}

async function openDialog(props: { busy?: boolean; onCancel?: () => void } = {}) {
  const user = userEvent.setup();
  render(<Harness {...props} />);
  await user.click(screen.getByRole("button", { name: "Auslöser" }));
  return { user, dialog: await screen.findByRole("dialog", { name: "Löschen?" }) };
}

describe("ConfirmDialog", () => {
  it("holt den Fokus auf Abbrechen, hält Tab im Dialog und gibt den Fokus zurück", async () => {
    const { user, dialog } = await openDialog();
    const link = within(dialog).getByRole("link");
    const cancel = within(dialog).getByRole("button", { name: de.common.cancel });
    const confirm = within(dialog).getByRole("button", { name: "Weg damit" });
    // Auf den sicheren Knopf, nicht auf das erste erreichbare Element.
    await waitFor(() => expect(cancel).toHaveFocus());

    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(link).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.getByRole("button", { name: "Auslöser" })).toHaveFocus());
  });

  it("schliesst während der Aktion weder mit Escape noch bei einem Klick daneben und hält den Fokus", async () => {
    const onCancel = vi.fn();
    const { user, dialog } = await openDialog({ busy: true, onCancel });
    // Abbrechen ist gesperrt, der Fokus bleibt beim Dialog selbst.
    await waitFor(() => expect(dialog).toHaveFocus());

    const link = within(dialog).getByRole("link");
    await user.tab();
    expect(link).toHaveFocus();
    await user.tab();
    expect(link).toHaveFocus();
    await user.keyboard("{Escape}");
    await user.click(dialog.parentElement as HTMLElement);
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
