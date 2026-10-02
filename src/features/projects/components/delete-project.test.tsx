import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { failedWrite, okWrite, queryChain } from "@tests/support/supabase-query";
import { DeleteProjectButton } from "./delete-project";

// Ein Projekt löschen heisst auch: die Dateien in zwei Buckets mitnehmen. Die
// Zeilen kaskadieren mit dem Projekt, die Objekte nicht. Diese Datei gab es
// bisher nicht, sie entstand mit den Chat-Anhängen (2026-10-02), die als
// zweiter Bucket dazukamen.

const push = vi.fn();
const refresh = vi.fn();
const toast = vi.fn();
const getUser = vi.fn();
const del = vi.fn();
const projectFilesRows = vi.fn();
const attachmentRange = vi.fn();
const storageRemove = vi.fn();
const order: string[] = [];

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/shared/ui/toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser },
    from: (table: string) => {
      if (table === "project_files") {
        return { select: () => queryChain(projectFilesRows()) };
      }
      if (table === "message_attachments") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ range: (...a: unknown[]) => attachmentRange(...a) }) }),
          }),
        };
      }
      return {
        delete: () => {
          order.push("delete-project");
          return del();
        },
      };
    },
    storage: {
      from: (bucket: string) => ({
        remove: (paths: string[]) => {
          order.push(`remove:${bucket}`);
          return storageRemove(bucket, paths);
        },
      }),
    },
  }),
}));

async function confirmDelete() {
  const user = userEvent.setup();
  render(<DeleteProjectButton projectId="proj-1" projectName="Hundesitter" />);
  await user.click(screen.getByRole("button", { name: "Löschen" }));
  // Der Bestätigungsdialog (ein Portal) hat einen eigenen Knopf.
  await user.click(await screen.findByRole("button", { name: "Projekt löschen" }));
}

describe("DeleteProjectButton", () => {
  beforeEach(() => {
    for (const m of [push, refresh, toast, getUser, del, projectFilesRows, attachmentRange, storageRemove]) {
      m.mockReset();
    }
    order.length = 0;
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    del.mockReturnValue(okWrite());
    projectFilesRows.mockReturnValue({ data: [], error: null });
    attachmentRange.mockResolvedValue({ data: [], error: null });
    storageRemove.mockResolvedValue({ error: null });
  });

  it("removes the project files and the chat attachments, in their own buckets", async () => {
    projectFilesRows.mockReturnValue({ data: [{ storage_path: "u1/proj-1/f.md" }], error: null });
    attachmentRange.mockResolvedValue({
      data: [{ storage_path: "u1/chat-1/a.png" }, { storage_path: "u1/chat-2/b.txt" }],
      error: null,
    });

    await confirmDelete();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects"));
    expect(storageRemove).toHaveBeenCalledWith("project-files", ["u1/proj-1/f.md"]);
    expect(storageRemove).toHaveBeenCalledWith("chat-attachments", [
      "u1/chat-1/a.png",
      "u1/chat-2/b.txt",
    ]);
  });

  // Die Reihenfolge ist der Punkt: die Pfade der Anhänge gibt es nur, solange
  // ihre Zeilen noch da sind (vor dem Löschen), die Objekte dürfen aber erst
  // weg, wenn das Löschen gelang (danach).
  it("reads the attachments before deleting the project, and removes their objects after", async () => {
    attachmentRange.mockImplementation(async () => {
      order.push("list-attachments");
      return { data: [{ storage_path: "u1/chat-1/a.png" }], error: null };
    });

    await confirmDelete();

    await waitFor(() => expect(storageRemove).toHaveBeenCalledWith("chat-attachments", expect.anything()));
    expect(order.indexOf("list-attachments")).toBeLessThan(order.indexOf("delete-project"));
    expect(order.indexOf("delete-project")).toBeLessThan(order.indexOf("remove:chat-attachments"));
  });

  it("leaves the attachment objects alone when deleting the project failed", async () => {
    attachmentRange.mockResolvedValue({ data: [{ storage_path: "u1/chat-1/a.png" }], error: null });
    del.mockReturnValue(failedWrite());

    await confirmDelete();

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error" })));
    expect(storageRemove).not.toHaveBeenCalledWith("chat-attachments", expect.anything());
    expect(push).not.toHaveBeenCalled();
  });

  it("still deletes the project when the attachments cannot be listed", async () => {
    attachmentRange.mockResolvedValue({ data: null, error: new Error("relation does not exist") });

    await confirmDelete();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects"));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
  });

  it("makes no attachment removal call for a project without attachments", async () => {
    await confirmDelete();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects"));
    expect(storageRemove).not.toHaveBeenCalledWith("chat-attachments", expect.anything());
  });
});
