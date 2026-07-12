import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PacketBridge } from "./packet-bridge";
import { DEFAULT_TOOLS } from "@/lib/tools";

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
  "Eine App, die Hobbyköchen hilft, ihre Vorräte zu verwalten und Rezepte vorzuschlagen.";

describe("PacketBridge", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    conversationsUpdate.mockReset();
    conversationsUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    vi.unstubAllGlobals();
  });

  it("shows the slim offer bar when not auto-opened", () => {
    render(
      <PacketBridge
        userMessages={["Erste Idee"]}
        defaultTools={DEFAULT_TOOLS}
        onOpenChange={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: /Paket bauen/ })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Projektname")).not.toBeInTheDocument();
  });

  it("prefills the project name and idea from the conversation when standalone", () => {
    render(
      <PacketBridge
        autoOpen
        userMessages={["Eine Rezept-App", LONG_ENOUGH_IDEA]}
        defaultTools={DEFAULT_TOOLS}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Projektname")).toHaveValue("Eine Rezept-App");
    expect(screen.getByLabelText("Deine Idee")).toHaveValue(
      `Eine Rezept-App\n\n${LONG_ENOUGH_IDEA}`
    );
  });

  it("shows the project's own name read-only and prefixes instructions into the idea for a workspace handoff", () => {
    render(
      <PacketBridge
        autoOpen
        userMessages={[LONG_ENOUGH_IDEA]}
        defaultTools={DEFAULT_TOOLS}
        existingProjectId="proj-1"
        projectName="Mein Projekt"
        projectInstructions="Immer auf Deutsch antworten."
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.queryByLabelText("Projektname")).not.toBeInTheDocument();
    expect(screen.getByText("Mein Projekt")).toBeInTheDocument();
    expect(screen.getByLabelText("Deine Idee")).toHaveValue(
      `Immer auf Deutsch antworten.\n\n${LONG_ENOUGH_IDEA}`
    );
  });

  it("disables the build button until name, idea, and audience all meet their limits", async () => {
    const user = userEvent.setup();
    render(
      <PacketBridge
        autoOpen
        userMessages={["Kurz"]}
        defaultTools={DEFAULT_TOOLS}
        onOpenChange={vi.fn()}
      />
    );
    const buildButton = screen.getByRole("button", { name: /Paket bauen/ });
    expect(buildButton).toBeDisabled();
    expect(screen.getByText(/Sag mir noch, wer das nutzen soll/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Zielgruppe"), "Hobbyköche");
    // Idea from "Kurz" alone is below ideaMin (20 chars) — still invalid.
    expect(buildButton).toBeDisabled();

    await user.clear(screen.getByLabelText("Deine Idee"));
    await user.type(screen.getByLabelText("Deine Idee"), LONG_ENOUGH_IDEA);
    expect(buildButton).not.toBeDisabled();
  });

  it("builds a standalone packet, links the conversation, and redirects to the new project", async () => {
    mockGenerateOnce({ projectId: "proj-99" });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PacketBridge
        autoOpen
        userMessages={["Rezept-App", LONG_ENOUGH_IDEA]}
        defaultTools={DEFAULT_TOOLS}
        conversationId="conv-1"
        onOpenChange={onOpenChange}
      />
    );
    expect(onOpenChange).toHaveBeenCalledWith(true);

    await user.type(screen.getByLabelText("Zielgruppe"), "Hobbyköche");
    await user.click(screen.getByRole("button", { name: /Paket bauen/ }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/generate",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"type":"software"'),
      })
    );
    expect(await screen.findByText(/Finn baut dein Paket/)).toBeInTheDocument();
    expect(await screen.findByText(/ich leg's dir hin/, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(conversationsUpdate).toHaveBeenCalledWith({ project_id: "proj-99" });

    // router.push only fires after the post-"done" HANDOFF_DELAY_MS beat.
    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/proj-99"), {
      timeout: 3000,
    });
    expect(refresh).toHaveBeenCalled();
  }, 10000);

  it("builds into an existing project and redirects to its results, without linking a conversation", async () => {
    mockGenerateOnce({ projectId: "proj-1" });
    const user = userEvent.setup();
    render(
      <PacketBridge
        autoOpen
        userMessages={[LONG_ENOUGH_IDEA]}
        defaultTools={DEFAULT_TOOLS}
        conversationId="conv-1"
        existingProjectId="proj-1"
        projectName="Mein Projekt"
        onOpenChange={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText("Zielgruppe"), "Hobbyköche");
    await user.click(screen.getByRole("button", { name: /Ergebnis erzeugen/ }));

    expect(await screen.findByText(/ich leg's dir hin/, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(conversationsUpdate).not.toHaveBeenCalled();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/proj-1/results"), {
      timeout: 3000,
    });
  }, 10000);

  it("shows an error and returns to the confirm stage when the request fails", async () => {
    mockGenerateOnce({ detail: "Server explodiert" }, false);
    const user = userEvent.setup();
    render(
      <PacketBridge
        autoOpen
        userMessages={[LONG_ENOUGH_IDEA]}
        defaultTools={DEFAULT_TOOLS}
        onOpenChange={vi.fn()}
      />
    );
    await user.type(screen.getByLabelText("Zielgruppe"), "Hobbyköche");
    await user.click(screen.getByRole("button", { name: /Paket bauen/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Server explodiert");
    expect(screen.getByLabelText("Deine Idee")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("treats a demo projectId as a failure needing a retry", async () => {
    mockGenerateOnce({ projectId: "demo" });
    const user = userEvent.setup();
    render(
      <PacketBridge
        autoOpen
        userMessages={[LONG_ENOUGH_IDEA]}
        defaultTools={DEFAULT_TOOLS}
        onOpenChange={vi.fn()}
      />
    );
    await user.type(screen.getByLabelText("Zielgruppe"), "Hobbyköche");
    await user.click(screen.getByRole("button", { name: /Paket bauen/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dein Paket konnte nicht gespeichert werden"
    );
  });

  it("calls onBack instead of falling back to idle when 'Zurück zum Chat' is clicked", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(
      <PacketBridge
        autoOpen
        userMessages={[LONG_ENOUGH_IDEA]}
        defaultTools={DEFAULT_TOOLS}
        onBack={onBack}
        onOpenChange={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Zurück zum Chat" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
