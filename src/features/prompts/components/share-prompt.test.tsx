import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { de } from "@/shared/i18n/messages/de";
import { ToastContext } from "@/shared/ui/toast-context";

const toast = vi.fn();
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));

import { SharePrompt } from "./share-prompt";
import { useShareStatus } from "@/features/prompts/hooks/use-share-status";

const TOKEN = "abcdefghijABCDEFGHIJ0123456789_-";

// Wie in der Karte: den Stand lädt useShareStatus, die Leiste zeigt ihn und meldet Teilen und Widerrufen zurück.
function SharePromptCard({ title = "Einladung", content }: { title?: string; content: string }) {
  const { share, setShare, reload } = useShareStatus("p1", true);
  return <SharePrompt promptId="p1" title={title} content={content} share={share} onShareChange={setShare} onReload={reload} />;
}
const fetchMock = vi.fn();

function answer(token: string | null, ok = true) {
  return Promise.resolve({ ok, json: async () => ({ token }) } as Response);
}

describe("SharePrompt", () => {
  beforeEach(() => {
    toast.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fragt vor dem Teilen nach und sagt, dass der Text öffentlich wird", async () => {
    fetchMock.mockReturnValueOnce(answer(null));
    render(<SharePromptCard content="Schreibe eine Einladung" />);
    const button = await screen.findByRole("button", { name: de.share.action });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    expect(screen.getByText(de.share.confirmBody)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(de.share.riskIntro))).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1); // nur der Stand, noch nichts geteilt

    fetchMock.mockReturnValueOnce(answer(TOKEN));
    fireEvent.click(screen.getByRole("button", { name: de.share.confirm }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/prompts/p1/share", { method: "POST" }));
    expect(await screen.findByText(`${window.location.origin}/geteilt/${TOKEN}`)).toBeInTheDocument();
  });

  it("warnt im Dialog, wenn der Prompt wie ein Schlüssel aussieht", async () => {
    fetchMock.mockReturnValueOnce(answer(null));
    render(<SharePromptCard content="Nutze den Key sk-ant-abcdefghijklmnopqrstuvwxyz0123" />);
    const button = await screen.findByRole("button", { name: de.share.action });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(screen.getByText(new RegExp(de.share.riskIntro))).toBeInTheDocument();
  });

  // Die Seite unter dem Link zeigt den Titel als Überschrift über dem Text: der Dialog prüft beides.
  it("warnt im Dialog auch, wenn nur der Titel persönliche Angaben enthält", async () => {
    fetchMock.mockReturnValueOnce(answer(null));
    render(<SharePromptCard title="Angebot für Anna Muster, anna.muster@beispiel.ch" content="Schreibe ein freundliches Angebot." />);
    const button = await screen.findByRole("button", { name: de.share.action });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(screen.getByText(new RegExp(de.share.riskIntro))).toHaveTextContent(
      `${de.chat.promptCheck.personal} (an…@beispiel.ch)`
    );
  });

  it("zeigt einen Fehler beim Nachsehen nicht als privat und lädt auf Knopfdruck neu", async () => {
    fetchMock.mockReturnValueOnce(answer(null, false));
    render(<SharePromptCard content="x" />);
    expect(await screen.findByText(de.share.statusFailed)).toBeInTheDocument();
    expect(screen.queryByText(de.share.privateHint)).not.toBeInTheDocument();

    fetchMock.mockReturnValueOnce(answer(TOKEN));
    fireEvent.click(screen.getByRole("button", { name: de.share.retry }));
    expect(await screen.findByText(`${window.location.origin}/geteilt/${TOKEN}`)).toBeInTheDocument();
  });

  // Der Hook hätte seinen eigenen Fehlschlag-Toast: nach dem Teilen sagt es die Leiste allein, genau einmal.
  it("sagt nicht 'kopiert', wenn die Zwischenablage ablehnt, und meldet es genau einmal", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) } });
    fetchMock.mockReturnValueOnce(answer(null));
    render(
      <ToastContext.Provider value={{ toast }}>
        <SharePromptCard content="x" />
      </ToastContext.Provider>
    );
    const button = await screen.findByRole("button", { name: de.share.action });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    fetchMock.mockReturnValueOnce(answer(TOKEN));
    fireEvent.click(screen.getByRole("button", { name: de.share.confirm }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: de.share.sharedNotCopied, variant: "success" }));
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("meldet am Knopf 'Link kopieren', wenn es nicht geht", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) } });
    fetchMock.mockReturnValueOnce(answer(TOKEN));
    render(
      <ToastContext.Provider value={{ toast }}>
        <SharePromptCard content="x" />
      </ToastContext.Provider>
    );

    fireEvent.click(await screen.findByRole("button", { name: de.share.copyLink }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: de.common.copyFailed,
        description: de.common.copyFailedHint,
        variant: "error",
      })
    );
    expect(screen.queryByRole("button", { name: de.common.copied })).not.toBeInTheDocument();
  });

  it("zeigt einen geteilten Prompt mit Link und widerruft ihn", async () => {
    fetchMock.mockReturnValueOnce(answer(TOKEN));
    render(<SharePromptCard content="x" />);
    await screen.findByText(`${window.location.origin}/geteilt/${TOKEN}`);

    fetchMock.mockReturnValueOnce(answer(null));
    fireEvent.click(screen.getByRole("button", { name: de.share.revoke }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/prompts/p1/share", { method: "DELETE" }));
    expect(await screen.findByRole("button", { name: de.share.action })).toBeInTheDocument();
  });
});
