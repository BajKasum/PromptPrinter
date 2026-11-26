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
// Jede ausgeführte Leseabfrage auf saved_prompt_versions: Spalten, Optionen, Seite oder gewünschte Nummern.
const reads = vi.fn();
type V = { version: number; content: string; created_at: string };
type Query = { columns: string; options?: { count?: string; head?: boolean }; versions?: number[]; page?: [number, number] };
let rows: V[] = [];
// So viele der nächsten Leseabfragen scheitern, gleich welcher Art.
let failingReads = 0;
// Hält die Abfragen nach dem Text oder nach einer Seite auf, bis das Versprechen erfüllt ist.
let textGate: Promise<void> | null = null;
let pageGate: Promise<void> | null = null;

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));
// saved_prompt_versions wie PostgREST: `head` zählt nur, `.range()` liefert eine Seite, `.in()` die gewünschten
// Nummern, und jede Zeile trägt nur die verlangten Spalten. saved_prompts: update().eq().eq().select().
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      const query: Query = { columns: "" };
      const sorted = () => [...rows].sort((a, b) => b.version - a.version);
      const pick = (list: V[]) => {
        const columns = query.columns.split(",").map((c) => c.trim());
        return list.map((r) => Object.fromEntries(columns.map((c) => [c, r[c as keyof V]])));
      };
      const failed = () => {
        if (failingReads === 0) return false;
        failingReads--;
        return true;
      };
      const chain = {
        select: (columns: string, options?: Query["options"]) => {
          if (table === "saved_prompts") return updated();
          Object.assign(query, { columns, options });
          return chain;
        },
        eq: (column: string, value: unknown) => {
          filters(table, column, value);
          return chain;
        },
        order: () => chain,
        in: (_column: string, versions: number[]) => {
          query.versions = versions;
          return chain;
        },
        range: async (from: number, to: number) => {
          reads({ ...query, page: [from, to] });
          if (failed()) return { data: null, error: { message: "nope" }, count: null };
          if (pageGate) await pageGate;
          return { data: pick(sorted().slice(from, to + 1)), error: null, count: rows.length };
        },
        update: (row: unknown) => {
          update(row);
          return chain;
        },
        // Ohne `.range()`: zählen (`head`) oder die Texte der gewünschten Nummern.
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          reads({ ...query });
          const run = async () => {
            if (failed()) return { data: null, error: { message: "nope" }, count: null };
            if (query.options?.head) return { data: null, error: null, count: rows.length };
            if (textGate) await textGate;
            return { data: pick(sorted().filter((r) => query.versions?.includes(r.version))), error: null };
          };
          return run().then(resolve, reject);
        },
      };
      return chain;
    },
  }),
}));

const at = "2026-11-20T10:00:00Z";
const textReads = () => reads.mock.calls.map(([q]) => q as Query).filter((q) => q.columns.includes("content"));

function renderHistory(content = "Ton: förmlich.", onRestored = vi.fn(), share: ShareStatus = { status: "private" }) {
  render(<PromptHistory promptId="p1" userId="u1" title="Brief" content={content} share={share} onRestored={onRestored} />);
  return { onRestored };
}

async function openHistory(user: ReturnType<typeof userEvent.setup>, versions = 2) {
  await user.click(await screen.findByRole("button", { name: `Verlauf (${versions} Versionen)` }));
}

describe("PromptHistory", () => {
  beforeEach(() => {
    refresh.mockReset();
    toast.mockReset();
    update.mockReset();
    filters.mockReset();
    reads.mockReset();
    updated.mockReset().mockResolvedValue({ data: [{ id: "p1" }], error: null });
    failingReads = 0;
    textGate = null;
    pageGate = null;
    rows = [
      { version: 1, content: "Ton: locker.", created_at: at },
      { version: 2, content: "Ton: förmlich.", created_at: at },
    ];
  });

  it("zeigt nichts, solange es nur eine Version gibt", async () => {
    rows = [rows[0]];
    renderHistory("Ton: locker.");
    await waitFor(() => expect(reads).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Verlauf/ })).toBeNull();
    expect(screen.queryByText("Der Verlauf liess sich nicht laden.")).toBeNull();
  });

  it("liest nur Versionen des Kontos und zeigt die Zahl", async () => {
    renderHistory();
    expect(await screen.findByRole("button", { name: "Verlauf (2 Versionen)" })).toHaveAttribute("aria-expanded", "false");
    expect(filters).toHaveBeenCalledWith("saved_prompt_versions", "prompt_id", "p1");
    expect(filters).toHaveBeenCalledWith("saved_prompt_versions", "user_id", "u1");
  });

  // Ein Prompt kann viele lange Fassungen haben. Die Karte klappt oft auf, der Verlauf öffnet selten: zum Aufklappen
  // gehört nur die Zahl, der Text kommt erst für die Fassungen, die der offene Verlauf vergleicht.
  describe("lädt nur, was zu sehen ist", () => {
    beforeEach(() => {
      rows = [1, 2, 3, 4, 5].map((n) => ({ version: n, content: `Fassung ${n}.`, created_at: at }));
    });

    it("zählt beim Aufklappen der Karte nur, ohne Zeilen und ohne Text", async () => {
      renderHistory("Fassung 5.");
      expect(await screen.findByRole("button", { name: "Verlauf (5 Versionen)" })).toBeInTheDocument();
      expect(reads).toHaveBeenCalledTimes(1);
      expect(reads).toHaveBeenCalledWith({ columns: "version", options: { count: "exact", head: true } });
    });

    it("lädt beim Öffnen Nummern und Zeiten und den Text nur der beiden verglichenen Fassungen", async () => {
      renderHistory("Fassung 5.");
      const user = userEvent.setup();
      await openHistory(user, 5);

      expect(await screen.findByRole("group", { name: "Unterschied von Version 4 zu Version 5" })).toBeInTheDocument();
      expect(reads).toHaveBeenCalledWith({ columns: "version, created_at", options: { count: "exact" }, page: [0, 19] });
      expect(textReads()).toEqual([{ columns: "version, content", versions: [4, 5] }]);

      // Eine andere ältere Fassung: nur ihr Text kommt dazu, der der neueren ist schon da.
      await user.selectOptions(screen.getByLabelText("Ältere Fassung"), "2");
      expect(await screen.findByRole("group", { name: "Unterschied von Version 2 zu Version 5" })).toBeInTheDocument();
      expect(textReads()).toEqual([
        { columns: "version, content", versions: [4, 5] },
        { columns: "version, content", versions: [2] },
      ]);
    });

    it("zeigt nach dem Wechsel der Fassung nichts Altes, bis ihr Text da ist", async () => {
      renderHistory("Fassung 5.");
      const user = userEvent.setup();
      await openHistory(user, 5);
      expect(await screen.findByRole("group", { name: "Unterschied von Version 4 zu Version 5" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Version 4 wiederherstellen" })).toBeInTheDocument();

      let release = () => {};
      textGate = new Promise<void>((resolve) => (release = resolve));
      await user.selectOptions(screen.getByLabelText("Ältere Fassung"), "1");
      expect(screen.queryByRole("group")).toBeNull();
      expect(screen.queryByRole("button", { name: /wiederherstellen/ })).toBeNull();

      release();
      expect(await screen.findByRole("group", { name: "Unterschied von Version 1 zu Version 5" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Version 1 wiederherstellen" })).toBeInTheDocument();
    });

    it("bietet ältere Versionen erst mit der ersten Seite an und holt dafür keinen Text", async () => {
      rows = Array.from({ length: 25 }, (_, i) => ({ version: i + 1, content: `Fassung ${i + 1}.`, created_at: at }));
      let release = () => {};
      pageGate = new Promise<void>((resolve) => (release = resolve));
      renderHistory("Fassung 25.");
      const user = userEvent.setup();
      await openHistory(user, 25);
      expect(screen.queryByRole("button", { name: "Ältere Versionen laden" })).toBeNull();

      release();
      await user.click(await screen.findByRole("button", { name: "Ältere Versionen laden" }));
      await waitFor(() => expect(screen.getByLabelText("Ältere Fassung").querySelectorAll("option")).toHaveLength(25));
      expect(screen.getByLabelText("Ältere Fassung")).toHaveValue("24");
      expect(reads).toHaveBeenCalledWith({ columns: "version, created_at", options: { count: "exact" }, page: [20, 39] });
      expect(textReads()).toEqual([{ columns: "version, content", versions: [24, 25] }]);
    });
  });

  it("zeigt einen Fehler beim Zählen als eigene Zeile und lädt auf Knopfdruck neu", async () => {
    failingReads = 1;
    renderHistory();
    expect(await screen.findByText("Der Verlauf liess sich nicht laden.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Verlauf/ })).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Neu laden" }));
    expect(await screen.findByRole("button", { name: "Verlauf (2 Versionen)" })).toBeInTheDocument();
    expect(screen.queryByText("Der Verlauf liess sich nicht laden.")).toBeNull();
  });

  it("sagt im offenen Verlauf, wenn ein Text nicht kam, und lädt ihn bei der nächsten Wahl neu", async () => {
    rows.push({ version: 3, content: "Ton: knapp.", created_at: at });
    renderHistory("Ton: knapp.");
    const user = userEvent.setup();
    await openHistory(user, 3);
    expect(await screen.findByRole("group", { name: "Unterschied von Version 2 zu Version 3" })).toBeInTheDocument();

    // Der Text von Version 1 scheitert einmal: kein Vergleich, keine Wiederherstellung, eine Meldung.
    failingReads = 1;
    await user.selectOptions(screen.getByLabelText("Ältere Fassung"), "1");
    expect(await screen.findByRole("alert")).toHaveTextContent("Der Verlauf liess sich nicht laden.");
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByRole("button", { name: /wiederherstellen/ })).toBeNull();

    await user.selectOptions(screen.getByLabelText("Ältere Fassung"), "2");
    expect(await screen.findByRole("group", { name: "Unterschied von Version 2 zu Version 3" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    await user.selectOptions(screen.getByLabelText("Ältere Fassung"), "1");
    expect(await screen.findByRole("group", { name: "Unterschied von Version 1 zu Version 3" })).toBeInTheDocument();
  });

  it("vergleicht die beiden neuesten Versionen Wort für Wort, für Screenreader benannt", async () => {
    renderHistory();
    const user = userEvent.setup();
    await openHistory(user);

    const diff = await screen.findByRole("group", { name: "Unterschied von Version 1 zu Version 2" });
    expect(screen.getByLabelText("Ältere Fassung")).toHaveValue("1");
    expect(screen.getByLabelText("Neuere Fassung")).toHaveValue("2");
    expect(diff.querySelector("del")).toHaveTextContent("entfernt: locker.");
    expect(diff.querySelector("ins")).toHaveTextContent("eingefügt: förmlich.");
    expect(within(diff).getByText("Ton:", { exact: false })).toBeInTheDocument();
  });

  it("sagt es, wenn zwei gewählte Versionen gleich sind", async () => {
    rows.push({ version: 3, content: "Ton: locker.", created_at: at });
    renderHistory("Ton: locker.");
    const user = userEvent.setup();
    await openHistory(user, 3);
    await waitFor(() => expect(screen.getByLabelText("Ältere Fassung")).toHaveValue("2"));
    await user.selectOptions(screen.getByLabelText("Ältere Fassung"), "1");
    expect(await screen.findByText("Keine Unterschiede zwischen diesen Versionen.")).toBeInTheDocument();
  });

  it("stellt eine alte Version wieder her: Text zurück, neue Nummer, nichts gelöscht", async () => {
    const { onRestored } = renderHistory();
    const user = userEvent.setup();
    await openHistory(user);
    // Die Datenbank legt beim Update die nächste Version an.
    updated.mockImplementation(async () => {
      rows.push({ version: 3, content: "Ton: locker.", created_at: at });
      return { data: [{ id: "p1" }], error: null };
    });
    await user.click(await screen.findByRole("button", { name: "Version 1 wiederherstellen" }));

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
    await openHistory(user);
    await screen.findByRole("button", { name: "Version 1 wiederherstellen" });
    await user.selectOptions(screen.getByLabelText("Ältere Fassung"), "2");
    expect(await screen.findByText("Keine Unterschiede zwischen diesen Versionen.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /wiederherstellen/ })).toBeNull();
  });

  it("setzt bei einem Fehler keinen Text und sagt es", async () => {
    const { onRestored } = renderHistory();
    updated.mockResolvedValue({ data: null, error: { message: "nope" } });
    const user = userEvent.setup();
    await openHistory(user);
    await user.click(await screen.findByRole("button", { name: "Version 1 wiederherstellen" }));
    expect(onRestored).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" }));
  });

  it("gibt den alten Text erst weiter, wenn er geschrieben ist", async () => {
    const { onRestored } = renderHistory();
    let finish: (value: unknown) => void = () => {};
    updated.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    await openHistory(user);
    await user.click(await screen.findByRole("button", { name: "Version 1 wiederherstellen" }));

    expect(onRestored).not.toHaveBeenCalled();
    rows.push({ version: 3, content: "Ton: locker.", created_at: at });
    finish({ data: [{ id: "p1" }], error: null });
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith("Ton: locker."));
  });

  it("bietet Wiederherstellen erst an, wenn der Text der Fassung geladen ist", async () => {
    let release = () => {};
    textGate = new Promise<void>((resolve) => (release = resolve));
    const { onRestored } = renderHistory();
    const user = userEvent.setup();
    await openHistory(user);
    await waitFor(() => expect(screen.getByLabelText("Ältere Fassung")).toHaveValue("1"));
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByRole("button", { name: /wiederherstellen/ })).toBeNull();

    release();
    await user.click(await screen.findByRole("button", { name: "Version 1 wiederherstellen" }));
    expect(update).toHaveBeenCalledWith({ outputs: { prompt: "Ton: locker.", title: "Brief" } });
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith("Ton: locker."));
  });

  // Ein geteilter Prompt steht in seiner aktuellen Fassung sofort unter dem Link: eine alte Fassung mit Schlüssel kommt
  // erst nach der Rückfrage zurück, auch solange der Stand lädt oder sich nicht lesen liess. Geprüft wird der Text, den
  // der Verlauf nachgeladen hat und schreibt.
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
      await openHistory(user);
      await user.click(await screen.findByRole("button", { name: "Version 1 wiederherstellen" }));

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
      await openHistory(user);

      expect(await screen.findByText("Dieser Prompt ist geteilt: die wiederhergestellte Fassung steht sofort unter dem Link.")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Version 1 wiederherstellen" }));
      expect(screen.queryByRole("alert")).toBeNull();
      expect(update).toHaveBeenCalledWith({ outputs: { prompt: "Ton: locker.", title: "Brief" } });
    });

    it("stellt bei einem privaten Prompt ohne Rückfrage wieder her", async () => {
      renderHistory();
      const user = userEvent.setup();
      await openHistory(user);
      await user.click(await screen.findByRole("button", { name: "Version 1 wiederherstellen" }));

      expect(screen.queryByText(/wiederhergestellte Fassung steht sofort unter dem Link/)).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(update).toHaveBeenCalledWith({ outputs: { prompt: KEY_TEXT, title: "Brief" } });
    });
  });

  it("bietet kein Wiederherstellen an, wenn die alte Fassung der aktuellen gleicht", async () => {
    rows.push({ version: 3, content: "Ton: locker.", created_at: at });
    renderHistory("Ton: locker.");
    const user = userEvent.setup();
    await openHistory(user, 3);
    await screen.findByRole("button", { name: "Version 2 wiederherstellen" });
    await user.selectOptions(screen.getByLabelText("Ältere Fassung"), "1");
    expect(await screen.findByText("Keine Unterschiede zwischen diesen Versionen.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /wiederherstellen/ })).toBeNull();
    await user.selectOptions(screen.getByLabelText("Ältere Fassung"), "2");
    expect(await screen.findByRole("button", { name: "Version 2 wiederherstellen" })).toBeInTheDocument();
  });
});
