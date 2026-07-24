import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";

const getUser = vi.fn();
const signOut = vi.fn();
const projectFilesSelect = vi.fn();
const storageRemove = vi.fn();
const deleteUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser, signOut },
    from: (table: string) => {
      if (table !== "project_files") throw new Error(`unexpected table ${table}`);
      return { select: () => ({ eq: () => projectFilesSelect() }) };
    },
    storage: { from: (bucket: string) => ({ remove: (paths: string[]) => storageRemove(bucket, paths) }) },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { deleteUser } },
  })),
}));

describe("DELETE /api/account", () => {
  beforeEach(() => {
    getUser.mockReset();
    signOut.mockReset();
    projectFilesSelect.mockReset();
    storageRemove.mockReset();
    deleteUser.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    projectFilesSelect.mockResolvedValue({ data: [] });
    storageRemove.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
  });

  it("requires authentication", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE();
    expect(res.status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("removes every attached project file and the avatar before deleting the account", async () => {
    projectFilesSelect.mockResolvedValue({
      data: [{ storage_path: "user-1/proj-a/file1.md" }, { storage_path: "user-1/proj-b/file2.txt" }],
    });

    const res = await DELETE();

    expect(storageRemove).toHaveBeenCalledWith("project-files", [
      "user-1/proj-a/file1.md",
      "user-1/proj-b/file2.txt",
    ]);
    expect(storageRemove).toHaveBeenCalledWith("avatars", ["user-1/avatar"]);
    expect(deleteUser).toHaveBeenCalledWith("user-1");
    expect(res.status).toBe(200);
  });

  it("skips the project-files removal call when there are no files", async () => {
    projectFilesSelect.mockResolvedValue({ data: [] });
    await DELETE();
    expect(storageRemove).not.toHaveBeenCalledWith("project-files", expect.anything());
    // The avatar path is always attempted, removing a never-uploaded path is a no-op.
    expect(storageRemove).toHaveBeenCalledWith("avatars", ["user-1/avatar"]);
  });

  it("still deletes the account when storage cleanup throws", async () => {
    storageRemove.mockRejectedValue(new Error("storage down"));
    const res = await DELETE();
    expect(deleteUser).toHaveBeenCalledWith("user-1");
    expect(res.status).toBe(200);
  });

  it("reports a clear error when the service-role key is missing", async () => {
    deleteUser.mockResolvedValue({ error: new Error("admin credentials missing") });
    const res = await DELETE();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("Service-Role-Key");
  });

  it("signs out locally after a successful deletion", async () => {
    await DELETE();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
