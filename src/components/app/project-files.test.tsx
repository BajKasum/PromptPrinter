import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectFiles } from "./project-files";
import type { ProjectFile } from "@/lib/project-files";

const refresh = vi.fn();
const getUser = vi.fn();
const storageUpload = vi.fn();
const storageRemove = vi.fn();
const filesInsert = vi.fn();
const filesDelete = vi.fn();
const toast = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser },
    storage: {
      from: () => ({ upload: storageUpload, remove: storageRemove }),
    },
    from: () => ({
      insert: filesInsert,
      delete: () => ({ eq: filesDelete }),
    }),
  }),
}));

function makeFile(name: string, sizeBytes: number, type = "text/plain") {
  const file = new File(["x".repeat(Math.min(sizeBytes, 10))], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

// applyAccept: false, the input's accept=".md,.txt,.json,.csv" would
// otherwise make user-event silently filter out a disallowed file before it
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
    toast.mockReset();
  });

  it("shows the current file count against the limit", () => {
    render(<ProjectFiles projectId="p1" initialFiles={[]} />);
    expect(screen.getByText("0/10")).toBeInTheDocument();
  });

  it("shows the format/size tip when there are no files yet", () => {
    render(<ProjectFiles projectId="p1" initialFiles={[]} />);
    expect(screen.getByText(/token-effizient/)).toBeInTheDocument();
  });

  it("hides the format/size tip once a file already exists", () => {
    render(
      <ProjectFiles
        projectId="p1"
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
    expect(screen.queryByText(/token-effizient/)).not.toBeInTheDocument();
  });

  it("rejects a disallowed extension without calling Supabase", async () => {
    render(<ProjectFiles projectId="p1" initialFiles={[]} />);
    await uploadFile(makeFile("script.exe", 100));
    expect(await screen.findByText(/Nur \.md, \.txt, \.json, \.csv/)).toBeInTheDocument();
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("rejects a file over the size limit without calling Supabase", async () => {
    render(<ProjectFiles projectId="p1" initialFiles={[]} />);
    await uploadFile(makeFile("notes.md", 300 * 1024));
    expect(await screen.findByText(/Höchstens 200 KB pro Datei/)).toBeInTheDocument();
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("refuses to upload once the file limit is reached", async () => {
    const initialFiles: ProjectFile[] = Array.from({ length: 10 }, (_, i) => ({
      id: `f${i}`,
      name: `file${i}.md`,
      storagePath: `path/${i}`,
      sizeBytes: 10,
      createdAt: new Date().toISOString(),
    }));
    render(<ProjectFiles projectId="p1" initialFiles={initialFiles} />);
    expect(screen.getByRole("button", { name: /Limit erreicht/ })).toBeDisabled();
  });

  it("uploads a valid file and lists it", async () => {
    render(<ProjectFiles projectId="p1" initialFiles={[]} />);
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
    render(<ProjectFiles projectId="p1" initialFiles={[]} />);
    await uploadFile(makeFile("notes.md", 100));

    expect(await screen.findByText(/Upload fehlgeschlagen/)).toBeInTheDocument();
    expect(storageRemove).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("notes.md")).not.toBeInTheDocument();
  });

  it("deletes a file from the list and storage", async () => {
    const initialFiles: ProjectFile[] = [
      { id: "f1", name: "notes.md", storagePath: "user-1/p1/f1-notes.md", sizeBytes: 42, createdAt: new Date().toISOString() },
    ];
    render(<ProjectFiles projectId="p1" initialFiles={initialFiles} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "notes.md löschen" }));

    expect(await screen.findByText("0/10")).toBeInTheDocument();
    expect(storageRemove).toHaveBeenCalledWith(["user-1/p1/f1-notes.md"]);
    expect(filesDelete).toHaveBeenCalledTimes(1);
  });

  it("toasts an error when delete fails and keeps the file listed", async () => {
    filesDelete.mockResolvedValue({ error: { message: "nope" } });
    const initialFiles: ProjectFile[] = [
      { id: "f1", name: "notes.md", storagePath: "path", sizeBytes: 42, createdAt: new Date().toISOString() },
    ];
    render(<ProjectFiles projectId="p1" initialFiles={initialFiles} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "notes.md löschen" }));

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
    expect(screen.getByText("notes.md")).toBeInTheDocument();
  });
});
