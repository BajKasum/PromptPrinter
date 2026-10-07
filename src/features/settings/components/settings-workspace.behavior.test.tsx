import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsWorkspace } from "./settings-workspace";

// Charakterisierungstests (Betriebs-Audit, Folgesitzung 2026-10-07, Teil E): halten die Einstellungsseite
// fest, BEVOR settings-workspace.tsx unter die 400-Zeilen-Grenze zerlegt wird (SettingsCard, Field und
// InfoRow in eine eigene Datei). Sie rufen nur die öffentliche Fläche (<SettingsWorkspace>) und müssen
// vor und nach dem Schnitt unverändert laufen.
//
// Die sechs eigenständigen Karten-Inhalte (Erscheinungsbild, Sprache, API-Keys, Passwort, Export, Konto
// löschen) haben eigene Tests und sind hier Attrappen; framer-motion ist zu einfachen Elementen vereinfacht,
// damit das Ein- und Ausblenden der Speicherleiste ohne Animation prüfbar ist.

const refresh = vi.fn();
const toast = vi.fn();
const update = vi.fn();
const eq = vi.fn();
let updateResult: { error: unknown } | Promise<{ error: unknown }> = { error: null };

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => ({
      update: (patch: unknown) => {
        update(table, patch);
        return {
          eq: (column: string, value: string) => {
            eq(column, value);
            return Promise.resolve(updateResult);
          },
        };
      },
    }),
  }),
}));
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const strip = ({ initial, animate, exit, transition, ...rest }: Record<string, unknown>) => {
    void initial;
    void animate;
    void exit;
    void transition;
    return rest;
  };
  return {
    motion: { div: (props: Record<string, unknown>) => React.createElement("div", strip(props)) },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useReducedMotion: () => false,
  };
});
vi.mock("@/features/settings/components/theme-preference", () => ({ ThemePreference: () => <div data-testid="theme-pref" /> }));
vi.mock("@/features/settings/components/language-preference", () => ({
  LanguagePreference: () => <div data-testid="language-pref" />,
}));
vi.mock("@/features/settings/components/change-password", () => ({ ChangePassword: () => <div data-testid="change-password" /> }));
vi.mock("@/features/settings/components/data-export", () => ({ DataExport: () => <div data-testid="data-export" /> }));
vi.mock("@/features/settings/components/delete-account", () => ({
  DeleteAccount: ({ email }: { email: string }) => <div data-testid="delete-account" data-email={email} />,
}));
vi.mock("@/features/settings/components/api-keys", () => ({
  ApiKeys: (props: { configured: string[]; active: string | null; customProvider: unknown }) => (
    <div
      data-testid="api-keys"
      data-configured={props.configured.join(",")}
      data-active={String(props.active)}
      data-custom={props.customProvider ? "ja" : "nein"}
    />
  ),
}));

const base = {
  userId: "user-1",
  email: "anna@example.test",
  initialDisplayName: "Anna",
  plan: "free" as const,
  memberSince: "2026-09-15T10:00:00.000Z",
  configuredProviders: [] as ("anthropic" | "openai" | "gemini" | "custom")[],
  activeProvider: null,
  customProvider: null,
};

const renderIt = (props: Partial<Parameters<typeof SettingsWorkspace>[0]> = {}) =>
  render(<SettingsWorkspace {...base} {...props} />);

const nameInput = () => screen.getByLabelText("Anzeigename");
const saveButton = () => screen.getByRole("button", { name: /Speichern/ });
const bar = () => screen.queryByText("Ungespeicherte Änderungen");

beforeEach(() => {
  refresh.mockReset();
  toast.mockReset();
  update.mockReset();
  eq.mockReset();
  updateResult = { error: null };
  window.history.replaceState(null, "", "/settings");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Karten", () => {
  it("zeigt die acht Karten in dieser Reihenfolge, jede mit Titel und Hinweis", () => {
    renderIt();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      "Profil",
      "Workspace",
      "Erscheinungsbild",
      "Sprache",
      "Eigene API-Keys",
      "Sicherheit",
      "Deine Daten",
      "Gefahrenzone",
    ]);
    for (const hint of [
      "Wie du in deinem Workspace erscheinst.",
      "Konto- und Plan-Übersicht.",
      "Die Sprache der App. Die Landing Page und die Rechtstexte bleiben Deutsch.",
      "Nutze dein eigenes Kontingent statt unserer Limits.",
      "Ändere dein Passwort.",
      "Eine Kopie von allem, was zu deinem Konto gehört.",
      "Unwiderrufliche Aktionen.",
    ]) {
      expect(screen.getByText(hint)).toBeInTheDocument();
    }
  });

  it("gibt nur Sprache und API-Keys einen Sprunganker (Key-Hinweis im Chat, Sprachwahl)", () => {
    const { container } = renderIt();
    const withId = Array.from(container.querySelectorAll("section[id]")).map((s) => s.id);
    expect(withId).toEqual(["language", "api-keys"]);
    expect(container.querySelectorAll("section")).toHaveLength(8);
    expect(container.querySelector("section#api-keys h2")?.textContent).toBe("Eigene API-Keys");
    expect(container.querySelector("section#language h2")?.textContent).toBe("Sprache");
  });

  it("jede Karte trägt ihren Inhalt: Attrappen für Erscheinungsbild, Sprache, Passwort, Export und Konto löschen", () => {
    renderIt();
    for (const id of ["theme-pref", "language-pref", "change-password", "data-export", "delete-account"]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(screen.getByTestId("delete-account")).toHaveAttribute("data-email", "anna@example.test");
  });

  it("reicht Schlüssel-Zustand an die API-Key-Karte weiter und nennt unter ihr den Hinweis zum Limit", () => {
    renderIt({ configuredProviders: ["openai", "custom"], activeProvider: "openai", customProvider: { label: "Z.ai", model: "m", baseUrl: "https://x.test" } as never });
    const keys = screen.getByTestId("api-keys");
    expect(keys).toHaveAttribute("data-configured", "openai,custom");
    expect(keys).toHaveAttribute("data-active", "openai");
    expect(keys).toHaveAttribute("data-custom", "ja");
    expect(
      screen.getByText("Mit eigenem Key entfällt das monatliche Chat-Limit, dein Projekt-Limit bleibt bestehen.")
    ).toBeInTheDocument();
  });

  it("färbt das Symbol jeder Karte mit ihrem Akzent, die Gefahrenzone mit dem Warnton", () => {
    const { container } = renderIt();
    const iconColors = Array.from(container.querySelectorAll("section > header > svg")).map(
      (svg) => (svg as SVGElement).getAttribute("style") ?? ""
    );
    expect(iconColors).toHaveLength(8);
    expect(iconColors.slice(0, 7).every((c) => c.includes("--accent"))).toBe(true);
    expect(iconColors[7]).toContain("--destructive");
  });
});

describe("Profil und Workspace", () => {
  it("zeigt Anzeigename (Feld mit Grenze und Autovervollständigung), E-Mail und Hinweis", () => {
    renderIt();
    const input = nameInput() as HTMLInputElement;
    expect(input.value).toBe("Anna");
    expect(input).toHaveAttribute("maxlength", "60");
    expect(input).toHaveAttribute("autocomplete", "name");
    expect(input).toHaveAttribute("placeholder", "Dein Name");
    expect(screen.getByText("anna@example.test")).toBeInTheDocument();
    expect(screen.getByText("Mit deinem Login verknüpft, hier nicht änderbar.")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("zeigt Rolle und 'Mitglied seit' (Monat und Jahr, in UTC), ohne Datum einen Strich", () => {
    const { unmount } = renderIt({ memberSince: "2026-09-30T23:30:00.000Z" });
    expect(screen.getByText("Rolle")).toBeInTheDocument();
    expect(screen.getByText("Eigentümer")).toBeInTheDocument();
    expect(screen.getByText("Mitglied seit")).toBeInTheDocument();
    expect(screen.getByText("September 2026")).toBeInTheDocument();
    unmount();

    renderIt({ memberSince: null });
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("zeigt den Plan als Pille, für Admins stattdessen 'Admin', und verlinkt die Abrechnung", () => {
    const { unmount } = renderIt({ plan: "pro" });
    expect(screen.getByText("pro")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Plan verwalten/ })).toHaveAttribute("href", "/billing");
    unmount();

    renderIt({ plan: "pro", isAdmin: true });
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.queryByText("pro")).not.toBeInTheDocument();
  });

  it("die Zeilen im Workspace und die Felder im Profil sind Beschriftung plus Wert", () => {
    const { container } = renderIt();
    const rows = container.querySelectorAll(".divide-y > div");
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText("Rolle")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("Mitglied seit")).toBeInTheDocument();
    // Field: Beschriftung als Text über dem Eingabefeld, nicht als <label>
    expect(screen.getByText("Anzeigename", { selector: "span" })).toBeInTheDocument();
  });
});

describe("Speicherleiste", () => {
  it("fehlt, solange nichts geändert ist, und erscheint, sobald der Name sich ändert", async () => {
    renderIt();
    expect(bar()).not.toBeInTheDocument();

    await userEvent.type(nameInput(), "x");
    expect(bar()).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
    expect(screen.getByRole("button", { name: "Verwerfen" })).toBeEnabled();
  });

  it("zählt Leerzeichen am Rand nicht als Änderung", async () => {
    renderIt();
    await userEvent.type(nameInput(), "   ");
    expect(bar()).not.toBeInTheDocument();
  });

  it("'Verwerfen' stellt den gespeicherten Namen wieder her und blendet die Leiste aus", async () => {
    renderIt();
    await userEvent.type(nameInput(), " Maria");
    expect((nameInput() as HTMLInputElement).value).toBe("Anna Maria");

    await userEvent.click(screen.getByRole("button", { name: "Verwerfen" }));

    expect((nameInput() as HTMLInputElement).value).toBe("Anna");
    expect(bar()).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it("ein leerer Name zeigt den Fehler, rahmt das Feld rot und sperrt Speichern (Verwerfen bleibt)", async () => {
    renderIt();
    await userEvent.clear(nameInput());

    expect(screen.getByText("Der Name darf nicht leer sein.")).toBeInTheDocument();
    expect(nameInput().className).toContain("border-destructive/55");
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Verwerfen" })).toBeEnabled();
  });

  it("die Leiste sitzt neben der Seitenleiste (Breite aus --sidebar-w, Rückfall 264px)", async () => {
    const { container } = renderIt();
    await userEvent.type(nameInput(), "x");
    const wrapper = container.querySelector(".fixed.inset-x-0");
    expect(wrapper?.className).toContain("md:pl-[var(--sidebar-w,264px)]");
  });
});

describe("Speichern", () => {
  it("schreibt den getrimmten Namen auf das eigene Profil, meldet Erfolg, lädt neu und schliesst die Leiste", async () => {
    renderIt();
    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), "  Maria Neu  ");

    await userEvent.click(saveButton());

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith("profiles", { display_name: "Maria Neu" });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(toast).toHaveBeenCalledWith({ title: "Einstellungen gespeichert", variant: "success" });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect((nameInput() as HTMLInputElement).value).toBe("Maria Neu");
    expect(bar()).not.toBeInTheDocument();
  });

  it("bei einem Fehler: Fehlermeldung, Leiste bleibt, kein Neuladen, Eingabe bleibt", async () => {
    updateResult = { error: { message: "nein" } };
    renderIt();
    await userEvent.type(nameInput(), "x");

    await userEvent.click(saveButton());

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith({
      title: "Konnte nicht gespeichert werden",
      description: "Bitte versuch es erneut.",
      variant: "error",
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(bar()).toBeInTheDocument();
    expect((nameInput() as HTMLInputElement).value).toBe("Annax");
    expect(saveButton()).toBeEnabled();
  });

  it("während des Speicherns steht 'Speichern…', beide Knöpfe sind gesperrt", async () => {
    let finish: (value: { error: unknown }) => void = () => {};
    updateResult = new Promise<{ error: unknown }>((resolve) => (finish = resolve));
    renderIt();
    await userEvent.type(nameInput(), "x");

    await act(async () => {
      fireEvent.click(saveButton());
    });
    expect(screen.getByRole("button", { name: /Speichern…/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Verwerfen" })).toBeDisabled();

    await act(async () => {
      finish({ error: null });
    });
    expect(bar()).not.toBeInTheDocument();
  });

  it("ein zweiter Klick während des Speicherns schreibt nicht ein zweites Mal", async () => {
    let finish: (value: { error: unknown }) => void = () => {};
    updateResult = new Promise<{ error: unknown }>((resolve) => (finish = resolve));
    renderIt();
    await userEvent.type(nameInput(), "x");

    await act(async () => {
      fireEvent.click(saveButton());
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Speichern…/ }));
    });
    expect(update).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish({ error: null });
    });
  });

  it("ohne Änderung speichert ein Klick nichts (kein Aufruf)", async () => {
    renderIt();
    expect(screen.queryByRole("button", { name: /Speichern/ })).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("Sprung zu einem Anker (/settings#api-keys)", () => {
  it("scrollt nach dem Einblenden zum Ziel der Adresse", () => {
    window.history.replaceState(null, "", "/settings#api-keys");
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.useFakeTimers();

    renderIt();
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });

  it("tut nichts ohne Anker und bricht beim Abbau den ausstehenden Sprung ab", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.useFakeTimers();

    const first = renderIt();
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(scrollIntoView).not.toHaveBeenCalled();
    first.unmount();

    // Ein Ziel, das den Abbau der Seite überlebt (sonst fände der Sprung nach dem Abbau ohnehin nichts):
    // nur das Abbrechen des ausstehenden Bildes verhindert dann den Sprung.
    const survivor = document.createElement("div");
    survivor.id = "api-keys";
    document.body.appendChild(survivor);
    try {
      window.history.replaceState(null, "", "/settings#api-keys");
      const second = renderIt();
      second.unmount(); // vor dem nächsten Bild
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      survivor.remove();
    }
  });
});
