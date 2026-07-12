import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromptSave } from "./prompt-save";

const push = vi.fn();
const refresh = vi.fn();
const conversationsUpdate = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({ update: conversationsUpdate }),
  }),
}));

function mockGenerateOnce(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: async () => body,
    })
  );
}

const LONG_ENOUGH_IDEA =
  "Ein Prompt, der mir hilft, Bewerbungsschreiben in einem professionellen Ton zu verfassen.";

describe("PromptSave", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    conversationsUpdate.mockReset();
    conversationsUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    vi.unstubAllGlobals();
  });

  it("shows the slim offer bar when not auto-opened", () => {
    render(
      <PromptSave userMessages={["Erste Idee"]} onOpenChange={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /Prompt speichern/ })).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("prefills name and idea from the conversation when standalone", () => {
    render(
      <PromptSave
        autoOpen
        userMessages={["Bewerbungs-Prompt", LONG_ENOUGH_IDEA]}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Bewerbungs-Prompt");
    expect(screen.getByLabelText(/Worum geht/)).toHaveValue(
      `Bewerbungs-Prompt\n\n${LONG_ENOUGH_IDEA}`
    );
  });

  it("pre-selects the initial target when it's a valid option", () => {
    render(
      <PromptSave
        autoOpen
        userMessages={[LONG_ENOUGH_IDEA]}
        initialTarget="Gemini"
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Ziel-KI")).toHaveValue("Gemini");
  });

  it("falls back to the first target option when initialTarget is unknown", () => {
    render(
      <PromptSave
        autoOpen
        userMessages={[LONG_ENOUGH_IDEA]}
        initialTarget="Some Unknown Tool"
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Ziel-KI")).toHaveValue("Claude");
  });

  it("shows the project's own name read-only for a workspace handoff", () => {
    render(
      <PromptSave
        autoOpen
        userMessages={[LONG_ENOUGH_IDEA]}
        existingProjectId="proj-1"
        projectName="Mein Projekt"
        projectInstructions="Immer freundlich bleiben."
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.getByText("Mein Projekt")).toBeInTheDocument();
    expect(screen.getByLabelText(/Worum geht/)).toHaveValue(
      `Immer freundlich bleiben.\n\n${LONG_ENOUGH_IDEA}`
    );
  });

  it("disables save until both name and idea meet their limits", async () => {
    const user = userEvent.setup();
    render(<PromptSave autoOpen userMessages={["Kurz"]} onOpenChange={vi.fn()} />);
    const saveButton = screen.getByRole("button", { name: /Speichern/ });
    expect(saveButton).toBeDisabled();
    expect(screen.getByText(/Beschreib es etwas ausführlicher/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Name"));
    expect(screen.getByText(/Gib ihm noch einen Namen/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "Mein Prompt");
    await user.clear(screen.getByLabelText(/Worum geht/));
    await user.type(screen.getByLabelText(/Worum geht/), LONG_ENOUGH_IDEA);
    expect(saveButton).not.toBeDisabled();
  });

  it("saves a standalone prompt, links the conversation, and redirects to the new project", async () => {
    mockGenerateOnce({ projectId: "proj-77" });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PromptSave
        autoOpen
        userMessages={["Bewerbungs-Prompt", LONG_ENOUGH_IDEA]}
        conversationId="conv-1"
        onOpenChange={onOpenChange}
      />
    );
    expect(onOpenChange).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole("button", { name: /Speichern/ }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/generate",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"type":"general"'),
      })
    );
    expect(await screen.findByText(/Finn macht die Endversion/)).toBeInTheDocument();
    expect(
      await screen.findByText(/deine Version liegt bereit/, {}, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(conversationsUpdate).toHaveBeenCalledWith({ project_id: "proj-77" });

    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/proj-77"), {
      timeout: 3000,
    });
    expect(refresh).toHaveBeenCalled();
  }, 10000);

  it("saves into an existing project and redirects to its results, without linking a conversation", async () => {
    mockGenerateOnce({ projectId: "proj-1" });
    const user = userEvent.setup();
    render(
      <PromptSave
        autoOpen
        userMessages={[LONG_ENOUGH_IDEA]}
        conversationId="conv-1"
        existingProjectId="proj-1"
        projectName="Mein Projekt"
        onOpenChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /Erzeugen/ }));

    expect(
      await screen.findByText(/deine Version liegt bereit/, {}, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(conversationsUpdate).not.toHaveBeenCalled();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/proj-1/results"), {
      timeout: 3000,
    });
  }, 10000);

  it("shows an error and returns to the confirm stage when the request fails", async () => {
    mockGenerateOnce({ detail: "Server explodiert" }, false);
    const user = userEvent.setup();
    render(
      <PromptSave autoOpen userMessages={[LONG_ENOUGH_IDEA]} onOpenChange={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: /Speichern/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Server explodiert");
    expect(screen.getByLabelText(/Worum geht/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("treats a demo projectId as a failure needing a retry", async () => {
    mockGenerateOnce({ projectId: "demo" });
    const user = userEvent.setup();
    render(
      <PromptSave autoOpen userMessages={[LONG_ENOUGH_IDEA]} onOpenChange={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: /Speichern/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Konnte nicht gespeichert werden");
  });

  it("calls onBack instead of falling back to idle when 'Zurück zum Chat' is clicked", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(
      <PromptSave
        autoOpen
        userMessages={[LONG_ENOUGH_IDEA]}
        onBack={onBack}
        onOpenChange={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Zurück zum Chat" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
