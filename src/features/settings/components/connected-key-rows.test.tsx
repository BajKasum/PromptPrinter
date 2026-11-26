import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectedCustomRow, ConnectedProviderRow } from "./connected-key-rows";

// Die Zeilen liegen seit der Zerlegung von api-keys.tsx (Betriebs-Audit, Folgesitzung 2026-10-07, Dateigröße) in
// connected-key-rows.tsx. Das Verhalten im Zusammenspiel prüft api-keys.rows.test.tsx über ApiKeys; hier steht,
// dass beide auch allein tragen, und dass Entfernen erst nach der Rückfrage löscht (#407).

const refresh = vi.fn();
const toast = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));

beforeEach(() => {
  refresh.mockReset();
  toast.mockReset();
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response);
  vi.stubGlobal("fetch", fetchMock);
});

const groq = { label: "Groq", baseUrl: "https://api.groq.com", model: "llama-3" };

const rows = [
  {
    name: "Anbieter",
    element: () => <ConnectedProviderRow provider="openai" isActive={false} canActivate />,
    trigger: "OpenAI-Key entfernen",
    title: "Key für OpenAI entfernen?",
    body: "Willst du wieder damit chatten, musst du ihn neu eingeben.",
    url: "/api/settings/api-key?provider=openai",
  },
  {
    name: "eigener Endpunkt",
    element: () => <ConnectedCustomRow meta={groq} />,
    trigger: "Custom-Key entfernen",
    title: "„Groq“ entfernen?",
    body: "Name, Endpoint, Modell und Key werden gelöscht.",
    url: "/api/settings/api-key?provider=custom",
  },
];

describe("ConnectedProviderRow", () => {
  it("zeigt den Anbieter mit dem Knopf zum Aktivieren", () => {
    render(<ConnectedProviderRow provider="openai" isActive={false} canActivate />);
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aktivieren" })).toBeInTheDocument();
  });
});

describe("ConnectedCustomRow", () => {
  it("zeigt Name und Modell", () => {
    render(<ConnectedCustomRow meta={groq} />);
    expect(screen.getByText("Groq")).toBeInTheDocument();
    expect(screen.getByText("llama-3")).toBeInTheDocument();
  });
});

describe.each(rows)("Key entfernen: $name", ({ element, trigger, title, body, url }) => {
  async function openDialog() {
    const user = userEvent.setup();
    render(element());
    await user.click(screen.getByRole("button", { name: trigger }));
    return { user, dialog: await screen.findByRole("dialog", { name: title }) };
  }

  it("fragt erst nach und löscht beim Klick auf den Papierkorb nichts", async () => {
    const { dialog } = await openDialog();
    expect(dialog).toHaveTextContent(body);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["Abbrechen", async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) => {
      await user.click(within(dialog).getByRole("button", { name: "Abbrechen" }));
    }],
    ["Escape", async (user: ReturnType<typeof userEvent.setup>) => {
      await user.keyboard("{Escape}");
    }],
  ])("löscht bei %s nichts und schliesst die Rückfrage", async (_name, leave) => {
    const { user, dialog } = await openDialog();

    await leave(user, dialog);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("löscht erst nach der Bestätigung, über DELETE", async () => {
    const { user, dialog } = await openDialog();

    await user.click(within(dialog).getByRole("button", { name: "Key entfernen" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toEqual([url, { method: "DELETE" }]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("sperrt die Rückfrage, solange gelöscht wird, und löscht nur einmal", async () => {
    let finish!: (res: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (finish = resolve)));
    const { user, dialog } = await openDialog();

    await user.click(within(dialog).getByRole("button", { name: "Key entfernen" }));

    const confirm = within(dialog).getByRole("button", { name: /Wird entfernt/ });
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Abbrechen" })).toBeDisabled();
    await user.keyboard("{Escape}");
    await user.click(confirm);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    finish({ ok: true, status: 200, json: async () => ({}) } as Response);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("schliesst die Rückfrage auch nach einem Fehlschlag und sagt ihn", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { user, dialog } = await openDialog();

    await user.click(within(dialog).getByRole("button", { name: "Key entfernen" }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast.mock.calls[0][0]).toMatchObject({ variant: "error" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: trigger })).toBeEnabled();
  });
});
