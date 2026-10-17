import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// Der Prüfdienst ist ersetzt: das Widget meldet sofort ein Token, sobald ein
// Schlüssel "gesetzt" ist. So lässt sich beides prüfen, mit und ohne Captcha.
const widget = vi.hoisted(() => ({ siteKey: undefined as string | undefined, autoToken: true }));

vi.mock("@/shared/ui/turnstile-widget", async () => {
  const React = await import("react");
  return {
    get TURNSTILE_SITE_KEY() {
      return widget.siteKey;
    },
    TurnstileWidget: ({ onToken }: { onToken: (t: string | null) => void }) => {
      React.useEffect(() => {
        if (widget.siteKey && widget.autoToken) onToken("token-xyz");
      }, [onToken]);
      return null;
    },
  };
});

import { ContactForm } from "./contact-form";

const fetchMock = vi.fn();

function fill({ email = "mira@example.com", message = "Wie viele Antworten sind im Gratis-Plan drin?" } = {}) {
  fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Deine Nachricht"), { target: { value: message } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Nachricht senden/ }));
}

describe("ContactForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    widget.siteKey = undefined;
    widget.autoToken = true;
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  });

  it("schickt Angaben, Thema und Token an /api/contact und zeigt danach die Bestätigung", async () => {
    widget.siteKey = "site-key";
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText("Name (freiwillig)"), { target: { value: "Mira" } });
    fireEvent.change(screen.getByLabelText("Worum geht es?"), { target: { value: "fehler" } });
    fill();
    submit();

    await waitFor(() => expect(screen.getByText("Angekommen, danke.")).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/contact");
    expect(JSON.parse(init.body as string)).toMatchObject({
      name: "Mira",
      email: "mira@example.com",
      topic: "fehler",
      message: "Wie viele Antworten sind im Gratis-Plan drin?",
      turnstileToken: "token-xyz",
    });
  });

  it("ohne gesetzten Captcha-Schlüssel (lokal) sendet es ohne Token", async () => {
    render(<ContactForm />);
    fill();
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).turnstileToken).toBeUndefined();
  });

  it("prüft die Adresse vor dem Senden und nennt den Grund", () => {
    render(<ContactForm />);
    fill({ email: "keine-adresse" });
    submit();
    expect(screen.getByRole("alert").textContent).toContain("gültige E-Mail-Adresse");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prüft die Länge der Nachricht vor dem Senden", () => {
    render(<ContactForm />);
    fill({ message: "Hi" });
    submit();
    expect(screen.getByRole("alert").textContent).toContain("mindestens 10");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verlangt die Mensch-Prüfung, solange bei gesetztem Schlüssel noch kein Token da ist", () => {
    widget.siteKey = "site-key";
    widget.autoToken = false;
    render(<ContactForm />);
    fill();
    submit();
    expect(screen.getByRole("alert").textContent).toContain("ein Mensch bist");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("zeigt die Meldung des Servers samt Adresse und bleibt im Formular", async () => {
    widget.siteKey = "site-key";
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Das Formular ist gerade nicht verfügbar. Schreib mir bitte direkt an kasumbajrami7@gmail.com." }), {
        status: 503,
      })
    );
    render(<ContactForm />);
    fill();
    submit();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("kasumbajrami7@gmail.com"));
    expect(screen.queryByText("Angekommen, danke.")).toBeNull();
  });

  it("nennt bei fehlender Verbindung die Adresse als Ausweg", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ContactForm />);
    fill();
    submit();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("kasumbajrami7@gmail.com"));
  });

  it("sendet das Köderfeld unverändert mit, wenn es gefüllt wurde (die Route entscheidet)", async () => {
    render(<ContactForm />);
    fill();
    const trap = document.querySelector<HTMLInputElement>('input[name="website"]')!;
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
    fireEvent.change(trap, { target: { value: "https://spam.example" } });
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).website).toBe("https://spam.example");
  });

  it("zeigt den Hinweis für eine Meldung rechtswidriger Inhalte nur bei diesem Thema", () => {
    render(<ContactForm />);
    expect(screen.queryByText("Was in einer Meldung stehen sollte")).toBeNull();

    fireEvent.change(screen.getByLabelText("Worum geht es?"), { target: { value: "melden" } });

    expect(screen.getByText("Was in einer Meldung stehen sollte")).toBeTruthy();
    expect(screen.getByText(/nach bestem Wissen und Gewissen/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Nutzungsrichtlinie" }).getAttribute("href")).toBe("/nutzungsrichtlinie");

    fireEvent.change(screen.getByLabelText("Worum geht es?"), { target: { value: "frage" } });
    expect(screen.queryByText("Was in einer Meldung stehen sollte")).toBeNull();
  });

  it("schickt das Thema melden an die Route", async () => {
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText("Worum geht es?"), { target: { value: "melden" } });
    fill();
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).topic).toBe("melden");
  });

  it("verlinkt die Datenschutzerklärung", () => {
    render(<ContactForm />);
    expect(screen.getByRole("link", { name: "Datenschutzerklärung" }).getAttribute("href")).toBe("/datenschutz");
  });
});
