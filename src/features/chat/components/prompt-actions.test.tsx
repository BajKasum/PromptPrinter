import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromptActions } from "./prompt-actions";
import { de } from "@/shared/i18n/messages/de";

const open = vi.fn();
const fetchMock = vi.fn();

beforeEach(() => {
  open.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("open", open);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("PromptActions", () => {
  it("öffnet ChatGPT leer und kopiert den Prompt (nie in der Adresse)", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<PromptActions prompt="Rolle: Du bist ein Tutor." />);

    await user.click(screen.getByRole("button", { name: "In ChatGPT öffnen" }));

    expect(open).toHaveBeenCalledWith("https://chatgpt.com/", "_blank", "noopener,noreferrer");
    expect(writeText).toHaveBeenCalledWith("Rolle: Du bist ein Tutor.");
    expect(await screen.findByText("Kopiert, einfach dort einfügen.")).toBeInTheDocument();
  });

  it("öffnet Claude leer und sagt, dass der Prompt kopiert ist", async () => {
    const user = userEvent.setup();
    render(<PromptActions prompt="Ein Prompt" />);

    await user.click(screen.getByRole("button", { name: "In Claude öffnen" }));

    expect(open).toHaveBeenCalledWith("https://claude.ai/new", "_blank", "noopener,noreferrer");
    expect(await screen.findByText("Kopiert, einfach dort einfügen.")).toBeInTheDocument();
  });

  it("Probelauf: zeigt die Antwort in einem beschrifteten, einklappbaren Bereich", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ reply: "Sehr geehrte Frau Muster" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    render(<PromptActions prompt="Ein Prompt" />);

    await user.click(screen.getByRole("button", { name: /Probelauf/ }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/test-run",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ prompt: "Ein Prompt", original: "Ein Prompt" }) })
    );
    const toggle = await screen.findByRole("button", { name: "So antwortet eine KI auf deinen Prompt" });
    expect(screen.getByText("Sehr geehrte Frau Muster")).toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Sehr geehrte Frau Muster")).toBeNull();
  });

  it("Probelauf abgelehnt: die Meldung des Servers steht da", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Diesen Prompt hast du schon einmal ausprobiert.", kind: "testRunUsed" }), {
        status: 403,
        headers: { "content-type": "application/problem+json" },
      })
    );
    render(<PromptActions prompt="Ein Prompt" />);

    await user.click(screen.getByRole("button", { name: /Probelauf/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("schon einmal ausprobiert");
  });

  const html = (status: number) => () =>
    Promise.resolve(new Response("<!DOCTYPE html><h1>Seite</h1>", { status, headers: { "content-type": "text/html" } }));

  it.each([
    ["ein 504 mit HTML-Seite", html(504), de.chat.testRun.failed],
    ["ein 200 mit HTML-Seite", html(200), de.chat.testRun.failed],
    ["kein Netz", () => Promise.reject(new TypeError("Failed to fetch")), de.common.networkError],
  ])("Probelauf bei %s: ein Satz aus dem Wörterbuch, nicht die Meldung des Browsers", async (_name, answer, text) => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(answer);
    render(<PromptActions prompt="Ein Prompt" />);

    await user.click(screen.getByRole("button", { name: /Probelauf/ }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(text);
    expect(alert).not.toHaveTextContent(/DOCTYPE|JSON|Failed to fetch/);
    expect(screen.queryByText("So antwortet eine KI auf deinen Prompt")).toBeNull();
  });
});
