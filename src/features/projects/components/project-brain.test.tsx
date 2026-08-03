import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectBrainCard } from "./project-brain";
import {
  BRAIN_ANALYZING_TIMEOUT_MS,
  EMPTY_BRAIN_FACTS,
  type ProjectBrain,
} from "@/shared/lib/project-brain";

const refresh = vi.fn();
const toast = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));

const IDLE: ProjectBrain = {
  status: "idle",
  facts: EMPTY_BRAIN_FACTS,
  repoUrl: null,
  sources: [],
  sourceDigest: null,
  model: null,
  errorCode: null,
  analyzedAt: null,
  updatedAt: new Date(0).toISOString(),
};

const READY: ProjectBrain = {
  ...IDLE,
  status: "ready",
  facts: {
    ...EMPTY_BRAIN_FACTS,
    summary: "Eine Next.js-App mit Supabase.",
    framework: "Next.js 15 (App Router)",
    language: "TypeScript (strict)",
    stack: ["Supabase", "Tailwind"],
    confidence: "high",
  },
  sources: [{ kind: "file", name: "package.json" }],
  sourceDigest: "aaaa1111",
  model: "glm-4.5-air",
  analyzedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function setup(overrides: Partial<React.ComponentProps<typeof ProjectBrainCard>> = {}) {
  render(
    <ProjectBrainCard
      projectId="proj-1"
      brain={IDLE}
      currentDigest="aaaa1111"
      sourceCount={2}
      {...overrides}
    />
  );
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

describe("ProjectBrainCard", () => {
  beforeEach(() => {
    refresh.mockReset();
    toast.mockReset();
    fetchMock.mockReset().mockResolvedValue(jsonResponse({ status: "ready" }));
    vi.stubGlobal("fetch", fetchMock);
  });

  it("explains what it does before it has ever run", () => {
    setup();
    expect(screen.getByRole("button", { name: /Projekt analysieren/ })).toBeEnabled();
    expect(screen.getByText(/kennt jeder Chat in diesem Projekt deinen Stack/)).toBeInTheDocument();
  });

  it("shows the detected facts once ready", () => {
    setup({ brain: READY });
    expect(screen.getByText("Eine Next.js-App mit Supabase.")).toBeInTheDocument();
    expect(screen.getByText("Next.js 15 (App Router)")).toBeInTheDocument();
    expect(screen.getByText("Supabase")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Neu analysieren/ })).toBeInTheDocument();
  });

  // Ein aus einer einzigen README abgeleitetes Ergebnis soll nicht aussehen
  // wie eines aus package.json plus Migrationen.
  it("surfaces how well-grounded the result is", () => {
    setup({ brain: READY });
    expect(screen.getByText(/gut belegt/)).toBeInTheDocument();

    screen.getByText(/gut belegt/).remove();
    setup({ brain: { ...READY, facts: { ...READY.facts, confidence: "low" } } });
    expect(screen.getByText(/unsicher/)).toBeInTheDocument();
  });

  it("cannot be started when there is nothing to read", () => {
    setup({ sourceCount: 0 });
    expect(screen.getByRole("button", { name: /Projekt analysieren/ })).toBeDisabled();
    expect(screen.getByText(/Lade zuerst Dateien hoch/)).toBeInTheDocument();
  });

  it("can be started with only a repository, before any upload", async () => {
    setup({ sourceCount: 0 });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/GitHub-Repository/), "github.com/acme/app");
    expect(screen.getByRole("button", { name: /Projekt analysieren/ })).toBeEnabled();
  });

  it("posts the repository url and refreshes on success", async () => {
    setup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/GitHub-Repository/), "github.com/acme/app");
    await user.click(screen.getByRole("button", { name: /Projekt analysieren/ }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/proj-1/brain",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ repoUrl: "github.com/acme/app" }),
      })
    );
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
  });

  it("sends null when the repository field was cleared", async () => {
    setup({ brain: { ...READY, repoUrl: "https://github.com/acme/app" } });
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/GitHub-Repository/));
    await user.click(screen.getByRole("button", { name: /Neu analysieren/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][1].body)).toBe(JSON.stringify({ repoUrl: null }));
  });

  it("shows the server's own message when the analysis is refused", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: "repo_not_found", detail: "Das Repository konnte nicht gelesen werden." }, 502)
    );
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Projekt analysieren/ }));

    expect(await screen.findByText(/Das Repository konnte nicht gelesen werden/)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("translates a bare error code when the server sent no message", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: "repo_rate_limited" }, 502));
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Projekt analysieren/ }));
    expect(await screen.findByText(/GitHub lässt gerade keine weiteren Abfragen zu/)).toBeInTheDocument();
  });

  it("reports a stored failure from an earlier run", () => {
    setup({ brain: { ...IDLE, status: "failed", errorCode: "repo_empty" } });
    expect(screen.getByText(/keine analysierbaren Dateien/)).toBeInTheDocument();
  });

  describe("laufende Analyse", () => {
    const analyzing: ProjectBrain = {
      ...IDLE,
      status: "analyzing",
      updatedAt: new Date().toISOString(),
    };

    it("shows progress and locks the controls", () => {
      setup({ brain: analyzing });
      expect(screen.getByText(/Ich lese mich gerade ein/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Analysiere/ })).toBeDisabled();
      expect(screen.getByLabelText(/GitHub-Repository/)).toBeDisabled();
    });

    // Die Analyse laeuft synchron in der Route; reisst der Request ab, bleibt
    // der Status stehen und der Prozess, der ihn aufraeumen sollte, ist genau
    // der, der weg ist. Deshalb entscheidet die Leseseite ueber den Zeitablauf.
    it("offers a retry once a stuck run is old enough", () => {
      setup({
        brain: {
          ...analyzing,
          updatedAt: new Date(Date.now() - BRAIN_ANALYZING_TIMEOUT_MS - 1000).toISOString(),
        },
      });
      expect(screen.getByRole("button", { name: /Projekt analysieren/ })).toBeEnabled();
      expect(screen.queryByText(/Ich lese mich gerade ein/)).not.toBeInTheDocument();
    });
  });

  describe("veraltete Quellen", () => {
    it("says so when the sources changed since the analysis", () => {
      setup({ brain: READY, currentDigest: "bbbb2222" });
      expect(screen.getByText(/haben sich deine Quellen geändert/)).toBeInTheDocument();
    });

    it("stays quiet when nothing changed", () => {
      setup({ brain: READY, currentDigest: "aaaa1111" });
      expect(screen.queryByText(/haben sich deine Quellen geändert/)).not.toBeInTheDocument();
    });

    it("never calls a never-analysed brain stale", () => {
      setup({ brain: IDLE, currentDigest: "bbbb2222" });
      expect(screen.queryByText(/haben sich deine Quellen geändert/)).not.toBeInTheDocument();
    });
  });

  describe("Loeschen", () => {
    it("asks before discarding what was learned", async () => {
      setup({ brain: READY });
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Gedächtnis löschen" }));

      expect(await screen.findByRole("dialog", { name: "Gedächtnis löschen?" })).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("deletes only after confirmation", async () => {
      setup({ brain: READY });
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Gedächtnis löschen" }));
      // Innerhalb des Dialogs suchen: der Ausloeser in der Karte und der
      // Bestaetigen-Knopf heissen gleich. Auf dem Bildschirm ist das
      // unproblematisch (der Dialog faengt den Fokus), im Test braucht es die
      // Eingrenzung.
      const dialog = await screen.findByRole("dialog", { name: "Gedächtnis löschen?" });
      await user.click(within(dialog).getByRole("button", { name: "Gedächtnis löschen" }));

      await waitFor(() => expect(refresh).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith("/api/projects/proj-1/brain", { method: "DELETE" });
    });

    it("offers no delete button when there is nothing to delete", () => {
      setup({ brain: IDLE });
      expect(screen.queryByRole("button", { name: "Gedächtnis löschen" })).not.toBeInTheDocument();
    });
  });
});
