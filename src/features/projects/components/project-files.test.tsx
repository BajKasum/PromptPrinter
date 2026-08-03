import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectFiles } from "./project-files";
import type { ProjectFile } from "@/features/projects/lib/project-files";

const refresh = vi.fn();
const getUser = vi.fn();
const storageUpload = vi.fn();
const storageRemove = vi.fn();
const filesInsert = vi.fn();
const filesDelete = vi.fn();
// QA finding F-6: handleFile re-counts server-side (RLS-scoped) right before
// the upload, instead of trusting local `files.length` state, since two open
// tabs each track that state independently.
const filesCount = vi.fn();
const toast = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/shared/ui/toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser },
    storage: {
      from: () => ({ upload: storageUpload, remove: storageRemove }),
    },
    from: () => ({
      // Security-Audit finding L-3 added a second .eq("user_id", …) after the
      // existing .eq("project_id", …), so this needs to stay chainable rather
      // than resolving on the first call — same shape supabase-js's real
      // builder has (each .eq() returns the builder, which is itself
      // thenable).
      select: () => {
        const chain = { eq: () => chain, then: (resolve: (v: unknown) => unknown) => resolve(filesCount()) };
        return chain;
      },
      insert: filesInsert,
      // Wie beim select oben: das Löschen filtert inzwischen auf id UND
      // user_id, also muss auch diese Kette das zweite .eq() überleben.
      // filesDelete bleibt der Spion, der das Ergebnis liefert.
      delete: () => {
        const chain = {
          eq: () => chain,
          then: (resolve: (v: unknown) => unknown) => resolve(filesDelete()),
        };
        return chain;
      },
    }),
  }),
}));

function makeFile(name: string, sizeBytes: number, type = "text/plain") {
  const file = new File(["x".repeat(Math.min(sizeBytes, 10))], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

// applyAccept: false, the input's own accept list (ALLOWED_FILE_EXTENSIONS)
// would otherwise make user-event silently filter out a disallowed file before it
// ever reaches the change handler, the same way a real file picker does.
// That's exactly the case the component's own hasAllowedExtension check
// guards against for drag-and-drop / "all files" picker overrides, so the
// test needs to bypass it to reach that validation branch.
async function uploadFile(file: File) {
  const user = userEvent.setup({ applyAccept: false });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, file);
  return user;
}

describe("ProjectFiles", () => {
  beforeEach(() => {
    refresh.mockReset();
    getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
    storageUpload.mockReset().mockResolvedValue({ error: null });
    storageRemove.mockReset().mockResolvedValue({ error: null });
    filesInsert.mockReset().mockResolvedValue({ error: null });
    filesDelete.mockReset().mockResolvedValue({ error: null });
    filesCount.mockReset().mockResolvedValue({ count: 0, error: null });
    toast.mockReset();
  });

  it("shows the current file count against the limit", () => {
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={[]} />);
    expect(screen.getByText("0/20")).toBeInTheDocument();
  });

  it("shows the format/size tip when there are no files yet", () => {
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={[]} />);
    expect(screen.getByText(/Screenshots/)).toBeInTheDocument();
  });

  it("hides the format/size tip once a file already exists", () => {
    render(
      <ProjectFiles
        projectId="p1"
        userId="u1"
        initialFiles={[
          {
            id: "f1",
            name: "notes.md",
            storagePath: "path",
            sizeBytes: 10,
            createdAt: new Date().toISOString(),
          },
        ]}
      />
    );
    expect(screen.queryByText(/Screenshots/)).not.toBeInTheDocument();
  });

  it("rejects a disallowed extension without calling Supabase", async () => {
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={[]} />);
    await uploadFile(makeFile("script.exe", 100));
    expect(await screen.findByText(/Dieses Format kann ich nicht lesen/)).toBeInTheDocument();
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("rejects a file over the size limit without calling Supabase", async () => {
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={[]} />);
    await uploadFile(makeFile("notes.md", 300 * 1024));
    expect(await screen.findByText(/Diese Datei ist zu gross/)).toBeInTheDocument();
    expect(storageUpload).not.toHaveBeenCalled();
  });

  // Die Groessengrenze gilt pro Art, nicht pauschal (maxBytesFor): waere sie
  // eine Zahl, koennte das Projekt-Gedaechtnis kein einziges echtes Lockfile
  // und keinen Screenshot analysieren.
  it("accepts a lockfile above the text limit", async () => {
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={[]} />);
    await uploadFile(makeFile("pnpm-lock.yaml", 600 * 1024));

    expect(await screen.findByText("pnpm-lock.yaml")).toBeInTheDocument();
    expect(storageUpload).toHaveBeenCalledTimes(1);
  });

  it("accepts a screenshot above the text limit", async () => {
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={[]} />);
    await uploadFile(makeFile("dashboard.png", 1500 * 1024, "image/png"));

    expect(await screen.findByText("dashboard.png")).toBeInTheDocument();
    expect(storageUpload).toHaveBeenCalledTimes(1);
  });

  it("still rejects a lockfile beyond its own, larger ceiling", async () => {
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={[]} />);
    await uploadFile(makeFile("pnpm-lock.yaml", 2 * 1024 * 1024));

    expect(await screen.findByText(/Diese Datei ist zu gross/)).toBeInTheDocument();
    expect(storageUpload).not.toHaveBeenCalled();
  });

  // Die Summe ist die eigentliche Schranke, seit Einzeldateien 2 MB duerfen.
  it("refuses an upload that would blow the project's total storage budget", async () => {
    const initialFiles: ProjectFile[] = [
      {
        id: "f1",
        name: "big.png",
        storagePath: "p",
        sizeBytes: 24 * 1024 * 1024,
        createdAt: new Date().toISOString(),
      },
    ];
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={initialFiles} />);
    await uploadFile(makeFile("another.png", 2 * 1024 * 1024, "image/png"));

    expect(await screen.findByText(/Speicherlimit des Projekts erreicht/)).toBeInTheDocument();
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("refuses to upload once the file limit is reached", async () => {
    const initialFiles: ProjectFile[] = Array.from({ length: 20 }, (_, i) => ({
      id: `f${i}`,
      name: `file${i}.md`,
      storagePath: `path/${i}`,
      sizeBytes: 10,
      createdAt: new Date().toISOString(),
    }));
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={initialFiles} />);
    expect(screen.getByRole("button", { name: /Limit erreicht/ })).toBeDisabled();
  });

  it("uploads a valid file and lists it", async () => {
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={[]} />);
    await uploadFile(makeFile("notes.md", 100));

    expect(await screen.findByText("notes.md")).toBeInTheDocument();
    expect(storageUpload).toHaveBeenCalledTimes(1);
    expect(filesInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "p1",
        user_id: "user-1",
        name: "notes.md",
        size_bytes: 100,
      })
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("rolls back the storage object when the DB insert fails", async () => {
    filesInsert.mockResolvedValue({ error: { message: "db down" } });
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={[]} />);
    await uploadFile(makeFile("notes.md", 100));

    expect(await screen.findByText(/Upload fehlgeschlagen/)).toBeInTheDocument();
    expect(storageRemove).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("notes.md")).not.toBeInTheDocument();
  });

  // QA finding F-6: local `files.length` state is what gates the button, but
  // two open tabs each track that independently. A fresh server-side count
  // right before the upload closes that race a step earlier than the DB
  // trigger (migration 0022) alone would.
  it("refuses to upload when a fresh server-side count already shows the limit reached", async () => {
    filesCount.mockResolvedValue({ count: 20, error: null });
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={[]} />);
    await uploadFile(makeFile("notes.md", 100));

    expect(await screen.findByText(/Höchstens 20 Dateien pro Projekt/)).toBeInTheDocument();
    expect(storageUpload).not.toHaveBeenCalled();
    expect(filesInsert).not.toHaveBeenCalled();
  });

  // The DB trigger's own raise messages (migration 0022) are the real
  // enforcement; the client-side checks above are only a fast pre-check.
  // Their exact text must map back to the same German messages, never leak
  // the raw Postgres error (same principle as U-4).
  it("shows the limit message when the DB trigger rejects the insert", async () => {
    filesInsert.mockResolvedValue({ error: { message: "Projekt-Dateilimit erreicht (20)" } });
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={[]} />);
    await uploadFile(makeFile("notes.md", 100));

    expect(await screen.findByText("Höchstens 20 Dateien pro Projekt.")).toBeInTheDocument();
  });

  it("shows the file-type message when the DB trigger rejects the insert", async () => {
    filesInsert.mockResolvedValue({ error: { message: "Dateityp nicht erlaubt" } });
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={[]} />);
    await uploadFile(makeFile("notes.md", 100));

    expect(await screen.findByText(/Dieses Format kann ich nicht lesen/)).toBeInTheDocument();
  });

  // QA finding A-2: the row's own delete button now only opens a confirm
  // dialog (ConfirmDialog, shared with DeleteProjectButton); the actual
  // delete only fires once "Datei löschen" inside it is clicked.
  async function deleteViaDialog(user: ReturnType<typeof userEvent.setup>, fileName: string) {
    await user.click(screen.getByRole("button", { name: `${fileName} löschen` }));
    await user.click(await screen.findByRole("button", { name: "Datei löschen" }));
  }

  it("does not delete on the row button alone, only opens a confirmation dialog", async () => {
    const initialFiles: ProjectFile[] = [
      { id: "f1", name: "notes.md", storagePath: "user-1/p1/f1-notes.md", sizeBytes: 42, createdAt: new Date().toISOString() },
    ];
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={initialFiles} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "notes.md löschen" }));

    expect(await screen.findByRole("dialog", { name: "Datei löschen?" })).toBeInTheDocument();
    expect(filesDelete).not.toHaveBeenCalled();
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it("cancelling the dialog leaves the file untouched", async () => {
    const initialFiles: ProjectFile[] = [
      { id: "f1", name: "notes.md", storagePath: "user-1/p1/f1-notes.md", sizeBytes: 42, createdAt: new Date().toISOString() },
    ];
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={initialFiles} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "notes.md löschen" }));
    await user.click(await screen.findByRole("button", { name: "Abbrechen" }));

    // AnimatePresence fades the dialog out rather than removing it instantly.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("notes.md")).toBeInTheDocument();
    expect(filesDelete).not.toHaveBeenCalled();
  });

  it("deletes a file from the list and storage once confirmed", async () => {
    const initialFiles: ProjectFile[] = [
      { id: "f1", name: "notes.md", storagePath: "user-1/p1/f1-notes.md", sizeBytes: 42, createdAt: new Date().toISOString() },
    ];
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={initialFiles} />);

    const user = userEvent.setup();
    await deleteViaDialog(user, "notes.md");

    expect(await screen.findByText("0/20")).toBeInTheDocument();
    expect(storageRemove).toHaveBeenCalledWith(["user-1/p1/f1-notes.md"]);
    expect(filesDelete).toHaveBeenCalledTimes(1);
  });

  // QA finding F-10: the DB row must go first. The old order (storage, then
  // row) meant a failed row-delete left a row pointing at an object that no
  // longer existed — a file that stayed listed but was silently empty. A row
  // without a storage object is visible and wrong; the reverse (an orphaned
  // object with no row, see P-6) is invisible and harmless, which is the
  // direction any partial failure here should fail toward.
  it("deletes the DB row before the storage object", async () => {
    const initialFiles: ProjectFile[] = [
      { id: "f1", name: "notes.md", storagePath: "user-1/p1/f1-notes.md", sizeBytes: 42, createdAt: new Date().toISOString() },
    ];
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={initialFiles} />);

    const user = userEvent.setup();
    await deleteViaDialog(user, "notes.md");
    await screen.findByText("0/20");

    expect(filesDelete.mock.invocationCallOrder[0]).toBeLessThan(
      storageRemove.mock.invocationCallOrder[0]
    );
  });

  it("toasts an error when the row delete fails, keeps the file listed, and never touches storage", async () => {
    filesDelete.mockResolvedValue({ error: { message: "nope" } });
    const initialFiles: ProjectFile[] = [
      { id: "f1", name: "notes.md", storagePath: "path", sizeBytes: 42, createdAt: new Date().toISOString() },
    ];
    render(<ProjectFiles projectId="p1" userId="u1" initialFiles={initialFiles} />);

    const user = userEvent.setup();
    await deleteViaDialog(user, "notes.md");

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
    expect(screen.getByText("notes.md")).toBeInTheDocument();
    // The row-delete failed, so the file object it would have pointed to must
    // stay untouched rather than becoming an orphan of the other kind.
    expect(storageRemove).not.toHaveBeenCalled();
  });
});
