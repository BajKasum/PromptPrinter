import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewProjectButton } from "./new-project";
import { de } from "@/shared/i18n/messages/de";

// "Neues Projekt": ein Name genügt. Scheitert das Anlegen, steht im Dialog ein verständlicher Satz, nie die Meldung
// des Browsers (#408).

const push = vi.fn();
const refresh = vi.fn();
const toast = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));

function answer(body: string, status: number, type: string) {
  return new Response(body, { status, headers: { "content-type": type } });
}

async function createProject(name = "Bewerbung") {
  const user = userEvent.setup();
  render(<NewProjectButton />);
  await user.click(screen.getByRole("button", { name: de.projects.newProject }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText(de.projects.nameLabel), name);
  await user.click(within(dialog).getByRole("button", { name: de.projects.create }));
  return { user, dialog };
}

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  toast.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("NewProjectButton", () => {
  it("legt das Projekt an und führt in den Workspace", async () => {
    fetchMock.mockResolvedValue(answer('{"projectId":"p-1"}', 200, "application/json"));

    await createProject();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/p-1"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ name: "Bewerbung" });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
  });

  it("zeigt bei einer Ablehnung den Satz der Route und bleibt offen", async () => {
    fetchMock.mockResolvedValue(
      answer('{"detail":"Projekt-Limit erreicht."}', 403, "application/problem+json")
    );

    const { dialog } = await createProject();

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Projekt-Limit erreicht.");
    expect(push).not.toHaveBeenCalled();
  });

  it("zeigt bei einem 504 mit HTML-Seite den eigenen Satz, nicht die Meldung des Browsers", async () => {
    fetchMock.mockResolvedValue(answer("<!DOCTYPE html><h1>504 Gateway Timeout</h1>", 504, "text/html"));

    const { dialog } = await createProject();

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(de.projects.createFailed);
    expect(dialog).not.toHaveTextContent(/DOCTYPE|JSON|Unexpected/);
    expect(push).not.toHaveBeenCalled();
  });

  it("zeigt ohne Netz den Netzwerk-Satz statt 'Failed to fetch'", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const { dialog } = await createProject();

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(de.common.networkError);
    expect(dialog).not.toHaveTextContent("Failed to fetch");
  });

  it.each([
    ["eine HTML-Seite", "<!DOCTYPE html>", "text/html"],
    ["ein JSON ohne projectId", "{}", "application/json"],
  ])("führt bei einem ok mit %s nirgends hin", async (_name, body, type) => {
    fetchMock.mockResolvedValue(answer(body, 200, type));

    const { dialog } = await createProject();

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(de.projects.createFailed);
    expect(push).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
});

// #368: Fokus, Tab und Escape wie bei jedem Dialog.
describe("NewProjectButton: Tastatur", () => {
  const trigger = () => screen.getByRole("button", { name: de.projects.newProject });

  async function openDialog() {
    const user = userEvent.setup();
    render(<NewProjectButton />);
    await user.click(trigger());
    const dialog = await screen.findByRole("dialog", { name: de.projects.newProjectDialog });
    const field = within(dialog).getByLabelText(de.projects.nameLabel);
    await waitFor(() => expect(field).toHaveFocus());
    return { user, dialog, field };
  }

  it("beginnt im Namensfeld, hält Tab im Dialog und gibt den Fokus nach Escape zurück", async () => {
    const { user, dialog, field } = await openDialog();

    await user.tab({ shift: true });
    expect(within(dialog).getByRole("button", { name: de.common.cancel })).toHaveFocus();
    await user.tab();
    expect(field).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger()).toHaveFocus();
  });

  it("bleibt offen, solange angelegt wird", async () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => {}));
    const { user, dialog } = await openDialog();
    await user.keyboard("Bewerbung{Enter}");

    await user.keyboard("{Escape}");
    await user.click(dialog.parentElement as HTMLElement);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("vergisst den Fehler, wenn Escape schliesst", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { user, dialog } = await openDialog();
    await user.keyboard("Bewerbung{Enter}");
    await within(dialog).findByRole("alert");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(trigger());
    expect(within(await screen.findByRole("dialog")).queryByRole("alert")).not.toBeInTheDocument();
  });
});
