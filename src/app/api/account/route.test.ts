import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";

const getUser = vi.fn();
const signOut = vi.fn();
const projectFilesSelect = vi.fn();
const profileSelect = vi.fn();
const storageRemove = vi.fn();
const deleteUser = vi.fn();
const rateLimit = vi.fn();
const captureError = vi.fn();
const cancelSubscriptionImmediately = vi.fn();

vi.mock("@/server/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser, signOut },
    from: (table: string) => {
      if (table === "project_files") return { select: () => ({ eq: () => projectFilesSelect() }) };
      if (table === "profiles")
        return { select: () => ({ eq: () => ({ maybeSingle: () => profileSelect() }) }) };
      throw new Error(`unexpected table ${table}`);
    },
    storage: { from: (bucket: string) => ({ remove: (paths: string[]) => storageRemove(bucket, paths) }) },
  })),
}));

vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { deleteUser } },
  })),
}));

vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
  rateLimitKey: () => "u:user-1",
}));

vi.mock("@/shared/lib/observability", () => ({
  captureError: (...args: unknown[]) => captureError(...args),
}));

// K-5 (Audit 06.09.2026): das eigentlich riskante Netzwerk-Ding, komplett
// gemockt — lemonsqueezy-api.test.ts deckt cancelSubscriptionImmediately
// selbst ab, hier zaehlt nur, DASS und WANN die Route sie aufruft.
vi.mock("@/server/billing/lemonsqueezy-api", () => ({
  cancelSubscriptionImmediately: (...args: unknown[]) => cancelSubscriptionImmediately(...args),
}));

function req() {
  return new Request("https://promptprinter.app/api/account", { method: "DELETE" });
}

describe("DELETE /api/account", () => {
  beforeEach(() => {
    getUser.mockReset();
    signOut.mockReset();
    projectFilesSelect.mockReset();
    profileSelect.mockReset();
    storageRemove.mockReset();
    deleteUser.mockReset();
    rateLimit.mockReset();
    captureError.mockReset();
    cancelSubscriptionImmediately.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    projectFilesSelect.mockResolvedValue({ data: [] });
    profileSelect.mockResolvedValue({ data: { is_admin: false, subscription_id: null } });
    storageRemove.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
    rateLimit.mockResolvedValue({ allowed: true, remaining: 4, resetAt: Date.now() + 1000 });
    cancelSubscriptionImmediately.mockResolvedValue({ ok: true, skipped: true });
  });

  it("requires authentication", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE(req());
    expect(res.status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("rejects once the hourly rate limit is exceeded", async () => {
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });
    const res = await DELETE(req());
    expect(res.status).toBe(429);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("skips the rate limit entirely for admin accounts", async () => {
    profileSelect.mockResolvedValue({ data: { is_admin: true, subscription_id: null } });
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });
    const res = await DELETE(req());
    expect(rateLimit).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("removes every attached project file and the avatar before deleting the account", async () => {
    projectFilesSelect.mockResolvedValue({
      data: [{ storage_path: "user-1/proj-a/file1.md" }, { storage_path: "user-1/proj-b/file2.txt" }],
    });

    const res = await DELETE(req());

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
    await DELETE(req());
    expect(storageRemove).not.toHaveBeenCalledWith("project-files", expect.anything());
    // The avatar path is always attempted, removing a never-uploaded path is a no-op.
    expect(storageRemove).toHaveBeenCalledWith("avatars", ["user-1/avatar"]);
  });

  it("still deletes the account when storage cleanup throws", async () => {
    storageRemove.mockRejectedValue(new Error("storage down"));
    const res = await DELETE(req());
    expect(deleteUser).toHaveBeenCalledWith("user-1");
    expect(res.status).toBe(200);
  });

  it("reports a clear error when the service-role key is missing", async () => {
    deleteUser.mockResolvedValue({ error: new Error("admin credentials missing") });
    const res = await DELETE(req());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("Service-Role-Key");
  });

  it("signs out locally after a successful deletion", async () => {
    await DELETE(req());
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  // K-5 (Audit 06.09.2026): ein zahlender Nutzer, der sein Konto loeschte,
  // wurde bisher weiter monatlich abgebucht -- fuer einen Zugang, den es
  // nicht mehr gab. Kontoloeschung muss deshalb zuerst das Abo bei
  // Lemon Squeezy kuendigen, waehrend die subscription_id noch bekannt ist.
  describe("Lemon-Squeezy-Abo kuendigen (K-5)", () => {
    it("kuendigt ein laufendes Abo, bevor das Konto geloescht wird", async () => {
      profileSelect.mockResolvedValue({ data: { is_admin: false, subscription_id: "sub_1" } });
      const order: string[] = [];
      cancelSubscriptionImmediately.mockImplementation(async () => {
        order.push("cancel");
        return { ok: true, skipped: false };
      });
      deleteUser.mockImplementation(async () => {
        order.push("delete");
        return { error: null };
      });

      const res = await DELETE(req());

      expect(res.status).toBe(200);
      expect(cancelSubscriptionImmediately).toHaveBeenCalledWith("sub_1");
      expect(order).toEqual(["cancel", "delete"]);
    });

    it("ruft Lemon Squeezy gar nicht auf, wenn kein Abo hinterlegt ist", async () => {
      profileSelect.mockResolvedValue({ data: { is_admin: false, subscription_id: null } });

      const res = await DELETE(req());

      expect(res.status).toBe(200);
      expect(cancelSubscriptionImmediately).not.toHaveBeenCalled();
    });

    it("loescht das Konto trotzdem, wenn die Kuendigung fehlschlaegt", async () => {
      profileSelect.mockResolvedValue({ data: { is_admin: false, subscription_id: "sub_1" } });
      cancelSubscriptionImmediately.mockResolvedValue({
        ok: false,
        reason: "lemonsqueezy-unreachable",
      });

      const res = await DELETE(req());

      expect(res.status).toBe(200);
      expect(deleteUser).toHaveBeenCalledWith("user-1");
      expect(captureError).toHaveBeenCalledWith(
        "account.subscription_cancel_failed",
        expect.anything(),
        expect.objectContaining({ userId: "user-1", subscriptionId: "sub_1" })
      );
    });
  });
});
