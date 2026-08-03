import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPublicHttpsUrl } from "@/server/security/url-safety";

const lookupMock = vi.fn();
vi.mock("node:dns", () => ({
  promises: { lookup: (...args: unknown[]) => lookupMock(...args) },
}));

afterEach(() => {
  lookupMock.mockReset();
});

describe("assertPublicHttpsUrl", () => {
  it("rejects a malformed URL", async () => {
    await expect(assertPublicHttpsUrl("not a url")).rejects.toThrow("Ungültige URL");
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects non-https protocols", async () => {
    await expect(assertPublicHttpsUrl("http://example.com/v1")).rejects.toThrow(
      "Nur https://"
    );
    await expect(assertPublicHttpsUrl("ftp://example.com/v1")).rejects.toThrow("Nur https://");
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects localhost by name without a DNS lookup", async () => {
    await expect(assertPublicHttpsUrl("https://localhost/v1")).rejects.toThrow(
      "nicht erlaubt"
    );
    await expect(assertPublicHttpsUrl("https://api.localhost/v1")).rejects.toThrow(
      "nicht erlaubt"
    );
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects a literal private IPv4 host without a DNS lookup", async () => {
    await expect(assertPublicHttpsUrl("https://127.0.0.1/v1")).rejects.toThrow("nicht erlaubt");
    await expect(assertPublicHttpsUrl("https://10.0.0.5/v1")).rejects.toThrow("nicht erlaubt");
    await expect(assertPublicHttpsUrl("https://192.168.1.1/v1")).rejects.toThrow(
      "nicht erlaubt"
    );
    // Cloud metadata endpoint, the classic SSRF target.
    await expect(assertPublicHttpsUrl("https://169.254.169.254/latest/meta-data")).rejects.toThrow(
      "nicht erlaubt"
    );
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("accepts a literal public IPv4 host without a DNS lookup", async () => {
    await expect(assertPublicHttpsUrl("https://93.184.216.34/v1")).resolves.toBeUndefined();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects a literal private/reserved IPv6 host", async () => {
    await expect(assertPublicHttpsUrl("https://[::1]/v1")).rejects.toThrow("nicht erlaubt");
    await expect(assertPublicHttpsUrl("https://[fe80::1]/v1")).rejects.toThrow("nicht erlaubt");
    await expect(assertPublicHttpsUrl("https://[fd00::1]/v1")).rejects.toThrow("nicht erlaubt");
    // IPv4-mapped IPv6 pointing at loopback.
    await expect(assertPublicHttpsUrl("https://[::ffff:127.0.0.1]/v1")).rejects.toThrow(
      "nicht erlaubt"
    );
  });

  it("rejects a hostname that resolves to a private address", async () => {
    lookupMock.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);
    await expect(assertPublicHttpsUrl("https://sneaky.example/v1")).rejects.toThrow(
      "nicht erlaubt"
    );
  });

  it("rejects a hostname with mixed public/private answers (any private address fails closed)", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(assertPublicHttpsUrl("https://mixed.example/v1")).rejects.toThrow(
      "nicht erlaubt"
    );
  });

  it("accepts a hostname that resolves only to public addresses", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await expect(assertPublicHttpsUrl("https://api.z.ai/v1")).resolves.toBeUndefined();
    expect(lookupMock).toHaveBeenCalledWith("api.z.ai", { all: true, verbatim: true });
  });

  it("rejects when DNS resolution fails", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertPublicHttpsUrl("https://nowhere.invalid/v1")).rejects.toThrow(
      "nicht aufgelöst"
    );
  });

  it("rejects when DNS resolution returns no records", async () => {
    lookupMock.mockResolvedValue([]);
    await expect(assertPublicHttpsUrl("https://empty.example/v1")).rejects.toThrow(
      "nicht aufgelöst"
    );
  });
});
