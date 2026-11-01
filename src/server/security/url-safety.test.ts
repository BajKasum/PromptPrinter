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

  it.each([
    ["Multicast", "ff02::1"],
    ["Site-Local", "fec0::1"],
    ["Dokumentation", "2001:db8::1"],
    ["Discard", "100::1"],
    ["IPv4-kompatibel, Loopback", "::7f00:1"],
    ["IPv4-kompatibel, gepunktet", "::127.0.0.1"],
    ["IPv4-gemappt, Metadaten", "::ffff:a9fe:a9fe"],
    ["IPv4-gemappt, ausgeschrieben", "0:0:0:0:0:ffff:7f00:1"],
    ["NAT64, Loopback", "64:ff9b::7f00:1"],
    ["NAT64, Metadaten", "64:ff9b::169.254.169.254"],
    ["NAT64, lokal", "64:ff9b:1::1"],
    ["6to4, Loopback", "2002:7f00:1::"],
    ["6to4, RFC1918", "2002:0a00:0001::1"],
    ["unspezifiziert, ausgeschrieben", "0:0:0:0:0:0:0:0"],
  ])("rejects IPv6 %s", async (_name, ip) => {
    await expect(assertPublicHttpsUrl(`https://[${ip}]/v1`)).rejects.toThrow("nicht erlaubt");
    lookupMock.mockResolvedValue([{ address: ip, family: 6 }]);
    await expect(assertPublicHttpsUrl("https://name.example/v1")).rejects.toThrow("nicht erlaubt");
  });

  it("rejects a resolved link-local address with a zone id", async () => {
    lookupMock.mockResolvedValue([{ address: "fe80::1%eth0", family: 6 }]);
    await expect(assertPublicHttpsUrl("https://name.example/v1")).rejects.toThrow("nicht erlaubt");
  });

  it.each([
    ["global", "2606:4700:4700::1111"],
    ["NAT64 auf öffentliches IPv4", "64:ff9b::808:808"],
    ["6to4 auf öffentliches IPv4", "2002:808:808::1"],
    ["IPv4-gemappt, öffentlich", "::ffff:808:808"],
  ])("accepts public IPv6 %s", async (_name, ip) => {
    await expect(assertPublicHttpsUrl(`https://[${ip}]/v1`)).resolves.toBeUndefined();
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
