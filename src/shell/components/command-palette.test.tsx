import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./command-palette";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// Die Listen der Palette (Chats, Projekte) sind hier leer, es geht um den Fokus.
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }),
  }),
}));

// Wie die Seitenleiste: Strg+K schaltet um, die Palette bittet selbst um Schliessen.
function Harness() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <textarea aria-label="Nachricht an Finn" />
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}

async function openFromComposer() {
  const user = userEvent.setup();
  render(<Harness />);
  const composer = screen.getByLabelText("Nachricht an Finn");
  composer.focus();
  await user.keyboard("{Control>}k{/Control}");
  const field = within(await screen.findByRole("dialog")).getByRole("textbox");
  await waitFor(() => expect(field).toHaveFocus());
  return { user, composer };
}

describe("Befehlspalette: Fokus (#151)", () => {
  beforeEach(() => push.mockClear());

  it("gibt den Fokus nach Escape an das Eingabefeld zurück, das ihn vorher hatte", async () => {
    const { user, composer } = await openFromComposer();
    await user.keyboard("{Escape}");
    expect(composer).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  it("gibt ihn auch bei einem Klick neben die Palette zurück", async () => {
    const { composer } = await openFromComposer();
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement as HTMLElement);
    await waitFor(() => expect(composer).toHaveFocus());
  });

  it("gibt ihn auch zurück, wenn Strg+K sie wieder zuklappt", async () => {
    const { user, composer } = await openFromComposer();
    await user.keyboard("{Control>}k{/Control}");
    expect(composer).toHaveFocus();
  });

  it("holt den Fokus nicht zurück, wenn ein Eintrag die Seite wechselt", async () => {
    const { user, composer } = await openFromComposer();
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledTimes(1);
    expect(composer).not.toHaveFocus();
  });

  it("merkt sich den Fokus bei jedem Öffnen neu", async () => {
    const { user, composer } = await openFromComposer();
    await user.keyboard("{Escape}");
    expect(composer).toHaveFocus();

    const other = document.createElement("button");
    document.body.appendChild(other);
    other.focus();
    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("{Escape}");
    expect(other).toHaveFocus();
    other.remove();
  });
});
