import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromptHistory } from "./prompt-history";
import type { ShareStatus } from "@/shared/lib/prompt-share-status";

const refresh = vi.fn();
const toast = vi.fn();
const update = vi.fn();
const filters = vi.fn();
const updated = vi.fn();
type V = { version: number; content: string; created_at: string };
let rows: V[] = [];

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));
// saved_prompt_versions: select(...).eq().eq().order().range() liefert die Zeilen samt Zahl; saved_prompts: update().eq().eq().select().
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      let page: [number, number] = [0, 1000];
      const chain = {
        select: () => (table === "saved_prompts" ? updated() : chain),
        eq: (column: string, value: unknown) => {
          filters(table, column, value);
          return chain;
        },
        order: () => chain,
        range: async (from: number, to: number) => {
          page = [from, to];
          const sorted = [...rows].sort((a, b) => b.version - a.version);
          return { data: sorted.slice(page[0], page[1] + 1), error: null, count: rows.length };
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

const at = "2026-11-20T10:00:00Z";

function renderHistory(content = "Ton: förmlich.", onRestored = vi.fn(), share: ShareStatus = { status: "private" }) {
  render(<PromptHistory promptId="p1" userId="u1" title="Brief" content={content} share={share} onRestored={onRestored} />);
  return { onRestored };
}

describe("PromptHistory", () => {
  beforeEach(() => {
    refresh.mockReset();
    toast.mockReset();
    update.mockReset();
    filters.mockReset();
    updated.mockReset().mockResolvedValue({ data: [{ id: "p1" }], error: null });
    rows = [
      { version: 1, content: "Ton: locker.", created_at: at },
      { version: 2, content: "Ton: förmlich.", created_at: at },
    ];
  });

  it("zeigt nichts, solange es nur eine Version gibt", async () => {
    rows = [rows[0]];
    renderHistory("Ton: locker.");
    await waitFor(() => expect(filters).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Verlauf/ })).toBeNull();
  });

  it("liest nur Versionen des Kontos und zeigt die Zahl", async () => {
    renderHistory();
    expect(await screen.findByRole("button", { name: "Verlauf (2 Versionen)" })).toHaveAttribute("aria-expanded", "false");
    expect(filters).toHaveBeenCalledWith("saved_prompt_versions", "prompt_id", "p1");
    expect(filters).toHaveBeenCalledWith("saved_prompt_versions", "user_id", "u1");
  });

  it("vergleicht die beiden neuesten Versionen Wort für Wort, für Screenreader benannt", async () => {
    renderHistory();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Verlauf (2 Versionen)" }));

    expect(screen.getByLabelText("Ältere Fassung")).toHaveValue("1");
    expect(screen.getByLabelText("Neuere Fassung")).toHaveValue("2");
    const diff = screen.getByRole("group", { name: "Unterschied von Version 1 zu Version 2" });
    expect(diff.querySelector("del")).toHaveTextContent("entfernt: locker.");
    expect(diff.querySelector("ins")).toHaveTextContent("eingefügt: förmlich.");
    expect(within(diff).getByText("Ton:", { exact: false })).toBeInTheDocument();
  });

  it("sagt es, wenn zwei gewählte Versionen gleich sind", async () => {
    rows.push({ version: 3, content: "Ton: locker.", created_at: at });
    renderHistory("Ton: locker.");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Verlauf (3 Versionen)" }));
    await user.selectOptions(screen.getByLabelText("Ältere Fassung"), "1");
    expect(screen.getByText("Keine Unterschiede zwischen diesen Versionen.")).toBeInTheDocument();
  });

  it("stellt eine alte Version wieder her: Text zurück, neue Nummer, nichts gelöscht", async () => {
    const { onRestored } = renderHistory();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Verlauf (2 Versionen)" }));
    // Die Datenbank legt beim Update die nächste Version an.
    updated.mockImplementation(async () => {
      rows.push({ version: 3, content: "Ton: locker.", created_at: at });
      return { data: [{ id: "p1" }], error: null };
    });
    await user.click(screen.getByRole("button", { name: "Version 1 wiederherstellen" }));

    expect(onRestored).toHaveBeenCalledWith("Ton: locker.");
    expect(update).toHaveBeenCalledWith({ outputs: { prompt: "Ton: locker.", title: "Brief" } });
    expect(filters).toHaveBeenCalledWith("saved_prompts", "user_id", "u1");
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Version 1 ist wieder aktuell, als Version 3", variant: "success" })
      )
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("bietet für die aktuelle Version kein Wiederherstellen an", async () => {
    renderHistory();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Verlauf (2 Versionen)" }));
    await user.selectOptions(screen.getByLabelText("Ältere Fassung"), "2");
    expect(screen.queryByRole("button", { name: /wiederherstellen/ })).toBeNull();
  });

  it("setzt bei einem Fehler keinen Text und sagt es", async () => {
    const { onRestored } = renderHistory();
    updated.mockResolvedValue({ data: null, error: { message: "nope" } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Verlauf (2 Versionen)" }));
    await user.click(screen.getByRole("button", { name: "Version 1 wiederherstellen" }));
    expect(onRestored).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
  });

  it("gibt den alten Text erst weiter, wenn er geschrieben ist", async () => {
    const { onRestored } = renderHistory();
    let finish: (value: unknown) => void = () => {};
    updated.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Verlauf (2 Versionen)" }));
    await user.click(screen.getByRole("button", { name: "Version 1 wiederherstellen" }));

    expect(onRestored).not.toHaveBeenCalled();
    rows.push({ version: 3, content: "Ton: locker.", created_at: at });
    finish({ data: [{ id: "p1" }], error: null });
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith("Ton: locker."));
  });

  // Ein geteilter Prompt steht in seiner aktuellen Fassung sofort unter dem Link: eine alte Fassung mit Schlüssel kommt
  // erst nach der Rückfrage zurück, auch solange der Stand lädt oder sich nicht lesen liess.
  describe("bei einem Prompt, der geteilt sein kann", () => {
    const KEY_TEXT = "Ton: locker. Key: sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";
    const SHARED: ShareStatus = { status: "shared", token: "abcdefghijABCDEFGHIJ0123456789_-" };

    beforeEach(() => {
      rows[0] = { version: 1, content: KEY_TEXT, created_at: at };
    });

    it.each<[string, ShareStatus]>([
      ["geteilt", SHARED],
      ["noch unterwegs", { status: "loading" }],
      ["nicht lesbar", { status: "error" }],
    ])("stellt eine Fassung mit Schlüssel erst nach der Rückfrage wieder her (Stand: %s)", async (_case, share) => {
      const { onRestored } = renderHistory("Ton: förmlich.", vi.fn(), share);
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "Verlauf (2 Versionen)" }));
      await user.click(screen.getByRole("button", { name: "Version 1 wiederherstellen" }));

      expect(update).not.toHaveBeenCalled();
      expect(onRestored).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent("Bitte prüf vorher: Sieht nach einem Schlüssel oder Passwort aus");

      await user.click(screen.getByRole("button", { name: "Version 1 trotzdem wiederherstellen" }));
      expect(update).toHaveBeenCalledWith({ outputs: { prompt: KEY_TEXT, title: "Brief" } });
      await waitFor(() => expect(onRestored).toHaveBeenCalledWith(KEY_TEXT));
    });

    it("sagt bei einem geteilten Prompt, dass die alte Fassung sofort unter dem Link steht", async () => {
      rows[0] = { version: 1, content: "Ton: locker.", created_at: at };
      renderHistory("Ton: förmlich.", vi.fn(), SHARED);
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "Verlauf (2 Versionen)" }));

      expect(screen.getByText("Dieser Prompt ist geteilt: die wiederhergestellte Fassung steht sofort unter dem Link.")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Version 1 wiederherstellen" }));
      expect(screen.queryByRole("alert")).toBeNull();
      expect(update).toHaveBeenCalledWith({ outputs: { prompt: "Ton: locker.", title: "Brief" } });
    });

    it("stellt bei einem privaten Prompt ohne Rückfrage wieder her", async () => {
      renderHistory();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: "Verlauf (2 Versionen)" }));
      expect(screen.queryByText(/wiederhergestellte Fassung steht sofort unter dem Link/)).toBeNull();
      await user.click(screen.getByRole("button", { name: "Version 1 wiederherstellen" }));

      expect(screen.queryByRole("alert")).toBeNull();
      expect(update).toHaveBeenCalledWith({ outputs: { prompt: KEY_TEXT, title: "Brief" } });
    });
  });

  it("bietet kein Wiederherstellen an, wenn die alte Fassung der aktuellen gleicht", async () => {
    rows.push({ version: 3, content: "Ton: locker.", created_at: at });
    renderHistory("Ton: locker.");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Verlauf (3 Versionen)" }));
    await user.selectOptions(screen.getByLabelText("Ältere Fassung"), "1");
    expect(screen.queryByRole("button", { name: /wiederherstellen/ })).toBeNull();
    await user.selectOptions(screen.getByLabelText("Ältere Fassung"), "2");
    expect(screen.getByRole("button", { name: "Version 2 wiederherstellen" })).toBeInTheDocument();
  });
});
