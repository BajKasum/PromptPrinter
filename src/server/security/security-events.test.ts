import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const from = vi.fn(() => ({ insert }));
const captureError = vi.fn();
const logged: string[] = [];

vi.mock("@/server/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));
vi.mock("@/shared/lib/observability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/observability")>()),
  captureError: (...a: unknown[]) => captureError(...a),
}));

const { recordSecurityEvent } = await import("@/server/security/security-events");

beforeEach(() => {
  vi.clearAllMocks();
  logged.length = 0;
  insert.mockResolvedValue({ error: null });
  vi.spyOn(console, "log").mockImplementation((line: string) => void logged.push(line));
});

describe("recordSecurityEvent", () => {
  it("schreibt Zeile und Logeintrag mit der Kennung des Kontos", async () => {
    await recordSecurityEvent("api_key.saved", "user-1", { provider: "openai", replaced: true });

    expect(from).toHaveBeenCalledWith("security_events");
    expect(insert).toHaveBeenCalledWith({
      event: "api_key.saved",
      user_id: "user-1",
      details: { provider: "openai", replaced: true },
    });
    expect(logged).toHaveLength(1);
    expect(JSON.parse(logged[0])).toMatchObject({ event: "api_key.saved", userId: "user-1", provider: "openai" });
  });

  it("lässt in der Tabelle keine Adresse und keinen Key zu, auch nicht in einem harmlos benannten Feld", async () => {
    await recordSecurityEvent("account.deleted", "user-1", {
      email: "opfer@example.com",
      apiKey: "sk-ant-api03-GEHEIM",
      reason: "angefragt von opfer@example.com mit sk-ant-api03-GEHEIM",
    });
    const stored = JSON.stringify(insert.mock.calls[0][0]);
    expect(stored).not.toContain("opfer@example.com");
    expect(stored).not.toContain("sk-ant-api03-GEHEIM");
    expect(logged.join("\n")).not.toContain("opfer@example.com");
    expect(logged.join("\n")).not.toContain("sk-ant-api03-GEHEIM");
  });

  it("wirft nie: ein Datenbankfehler landet im Log, und die Aktion des Nutzers bleibt gültig", async () => {
    insert.mockResolvedValue({ error: { message: "db down" } });
    await expect(recordSecurityEvent("api_key.removed", "user-1")).resolves.toBeUndefined();
    expect(captureError).toHaveBeenCalledWith(
      "security_events.write_failed",
      expect.anything(),
      { event: "api_key.removed", userId: "user-1" }
    );
  });

  it("wirft auch dann nicht, wenn der Admin-Client selbst scheitert", async () => {
    from.mockImplementationOnce(() => {
      throw new Error("admin credentials missing");
    });
    await expect(recordSecurityEvent("account.deleted", "user-1")).resolves.toBeUndefined();
    expect(captureError).toHaveBeenCalledTimes(1);
  });
});
