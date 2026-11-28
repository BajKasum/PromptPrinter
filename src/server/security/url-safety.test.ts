import { afterEach, describe, expect, it, vi } from "vitest";
import { addressBucket, assertPublicHttpsUrl, assertServerEndpointUrl } from "@/server/security/url-safety";

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

describe("assertServerEndpointUrl (LLM_BASE_URL des Betreibers)", () => {
  it("lässt im Einzelbetrieb den eigenen Rechner, das eigene Netz und http zu, ohne DNS", async () => {
    for (const url of [
      "http://localhost:11434/v1/chat/completions",
      "http://127.0.0.1:1234/v1/chat/completions",
      "http://host.docker.internal:11434/v1/chat/completions",
      "http://192.168.1.20:8080/v1/chat/completions",
      "http://[::1]:11434/v1/chat/completions",
      "https://openrouter.ai/api/v1/chat/completions",
    ]) {
      await expect(assertServerEndpointUrl(url, true), url).resolves.toBeUndefined();
    }
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("verlangt auch im Einzelbetrieb eine http(s)-Adresse", async () => {
    await expect(assertServerEndpointUrl("kein url", true)).rejects.toThrow("Ungültige URL");
    await expect(assertServerEndpointUrl("file:///etc/passwd", true)).rejects.toThrow("Nur http:// und https://");
    await expect(assertServerEndpointUrl("ftp://localhost/v1", true)).rejects.toThrow("Nur http:// und https://");
  });

  it("ohne Einzelbetrieb gilt dieselbe Sperre wie für einen BYOK-Endpunkt", async () => {
    await expect(assertServerEndpointUrl("http://localhost:11434/v1/chat/completions", false)).rejects.toThrow(
      "Nur https://"
    );
    await expect(assertServerEndpointUrl("https://localhost/v1", false)).rejects.toThrow("nicht erlaubt");
    await expect(assertServerEndpointUrl("https://127.0.0.1/v1", false)).rejects.toThrow("nicht erlaubt");
    lookupMock.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    await expect(assertServerEndpointUrl("https://intern.example/v1", false)).rejects.toThrow("nicht erlaubt");
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await expect(assertServerEndpointUrl("https://api.example.com/v1", false)).resolves.toBeUndefined();
  });
});

// Die Grenzen jedes gesperrten IPv4-Bereichs: erste und letzte Adresse gesperrt, die Nachbarn davor und danach offen.
// Ein Bereich, der um eine Adresse zu eng ist (etwa 172.16 bis 172.30), fiele an einer Stichprobe aus der Mitte nicht auf.
describe("assertPublicHttpsUrl: Grenzen der IPv4-Bereiche", () => {
  const RANGES: [string, string, string, (string | null)[]][] = [
    ["0.0.0.0/8, dieses Netz", "0.0.0.0", "0.255.255.255", [null, "1.0.0.0"]],
    ["10.0.0.0/8", "10.0.0.0", "10.255.255.255", ["9.255.255.255", "11.0.0.0"]],
    ["100.64.0.0/10, CGNAT", "100.64.0.0", "100.127.255.255", ["100.63.255.255", "100.128.0.0"]],
    ["127.0.0.0/8, Loopback", "127.0.0.0", "127.255.255.255", ["126.255.255.255", "128.0.0.0"]],
    ["169.254.0.0/16, Link-Local", "169.254.0.0", "169.254.255.255", ["169.253.255.255", "169.255.0.0"]],
    ["172.16.0.0/12", "172.16.0.0", "172.31.255.255", ["172.15.255.255", "172.32.0.0"]],
    ["192.168.0.0/16", "192.168.0.0", "192.168.255.255", ["192.167.255.255", "192.169.0.0"]],
    ["192.0.0.0/24, IETF", "192.0.0.0", "192.0.0.255", ["191.255.255.255", "192.0.1.0"]],
    ["192.0.2.0/24, TEST-NET-1", "192.0.2.0", "192.0.2.255", ["192.0.1.255", "192.0.3.0"]],
    ["198.18.0.0/15, Benchmark", "198.18.0.0", "198.19.255.255", ["198.17.255.255", "198.20.0.0"]],
    ["198.51.100.0/24, TEST-NET-2", "198.51.100.0", "198.51.100.255", ["198.51.99.255", "198.51.101.0"]],
    ["203.0.113.0/24, TEST-NET-3", "203.0.113.0", "203.0.113.255", ["203.0.112.255", "203.0.114.0"]],
    ["224.0.0.0 aufwärts, Multicast und reserviert", "224.0.0.0", "255.255.255.255", ["223.255.255.255", null]],
  ];

  /** Als Adresse in der URL (ohne DNS) und als Antwort des Namensdienstes. */
  async function refused(ip: string) {
    await expect(assertPublicHttpsUrl(`https://${ip}/v1`), `URL ${ip}`).rejects.toThrow("nicht erlaubt");
    lookupMock.mockResolvedValue([{ address: ip, family: 4 }]);
    await expect(assertPublicHttpsUrl("https://name.example/v1"), `DNS ${ip}`).rejects.toThrow("nicht erlaubt");
  }
  async function allowed(ip: string) {
    await expect(assertPublicHttpsUrl(`https://${ip}/v1`), `URL ${ip}`).resolves.toBeUndefined();
    lookupMock.mockResolvedValue([{ address: ip, family: 4 }]);
    await expect(assertPublicHttpsUrl("https://name.example/v1"), `DNS ${ip}`).resolves.toBeUndefined();
  }

  it.each(RANGES)("%s", async (_name, first, last, neighbors) => {
    await refused(first);
    await refused(last);
    for (const neighbor of neighbors) if (neighbor) await allowed(neighbor);
  });

  it("sperrt eine Antwort des Namensdienstes, die keine Adresse ist", async () => {
    lookupMock.mockResolvedValue([{ address: "keine-adresse", family: 4 }]);
    await expect(assertPublicHttpsUrl("https://name.example/v1")).rejects.toThrow("nicht erlaubt");
  });
});

// Dieselbe Prüfung für IPv6. fe80::/10, fec0::/10 und ff00::/8 liegen lückenlos hintereinander, sie haben deshalb nur
// vor dem ersten Bereich einen offenen Nachbarn. Die letzten vier Zeilen tragen eine IPv4-Adresse in sich: gesperrt,
// wenn diese privat ist, offen, wenn sie öffentlich ist oder die Adresse knapp neben dem Trägerbereich liegt.
describe("assertPublicHttpsUrl: Grenzen der IPv6-Bereiche", () => {
  const ones = (count: number) => ":ffff".repeat(count);
  const RANGES: [string, string[], string[]][] = [
    ["fc00::/7, Unique Local", ["fc00::", `fdff${ones(7)}`], [`fbff${ones(7)}`, "fe00::"]],
    ["fe80::/10, Link-Local", ["fe80::", `febf${ones(7)}`], [`fe7f${ones(7)}`]],
    ["fec0::/10, Site-Local", ["fec0::", `feff${ones(7)}`], []],
    ["ff00::/8, Multicast", ["ff00::", `ffff${ones(7)}`], []],
    ["2001:db8::/32, Dokumentation", ["2001:db8::", `2001:db8${ones(6)}`], [`2001:db7${ones(6)}`, "2001:db9::"]],
    ["100::/64, Discard", ["100::", `100:0:0:0${ones(4)}`], [`ff${ones(7)}`, "100:0:0:1::"]],
    ["64:ff9b:1::/48, NAT64 lokal", ["64:ff9b:1::", `64:ff9b:1${ones(5)}`], [`64:ff9b:0${ones(5)}`, "64:ff9b:2::"]],
    ["3fff::/20, Dokumentation", ["3fff::", `3fff:fff${ones(6)}`], [`3ffe${ones(7)}`, "3fff:1000::"]],
    ["5f00::/16, SRv6", ["5f00::", `5f00${ones(7)}`], [`5eff${ones(7)}`, "5f01::"]],
    ["::/96, IPv4-kompatibel", ["::", "::a00:1", "::ffff:ffff"], ["::808:808", "::1:7f00:1"]],
    ["::ffff:0:0/96, IPv4-gemappt", ["::ffff:0:0", "::ffff:a00:1"], ["::ffff:808:808", "::fffe:7f00:1"]],
    ["64:ff9b::/96, NAT64", ["64:ff9b::", "64:ff9b::a00:1"], ["64:ff9b::808:808", "64:ff9b::1:7f00:1"]],
    ["2002::/16, 6to4", ["2002::", `2002:7f00:1${ones(5)}`, `2002${ones(7)}`], [`2002:808:808${ones(5)}`, "2001:7f00:1::", "2003:7f00:1::"]],
  ];

  it.each(RANGES)("%s", async (_name, blocked, open) => {
    for (const ip of blocked) {
      await expect(assertPublicHttpsUrl(`https://[${ip}]/v1`), `URL ${ip}`).rejects.toThrow("nicht erlaubt");
      lookupMock.mockResolvedValue([{ address: ip, family: 6 }]);
      await expect(assertPublicHttpsUrl("https://name.example/v1"), `DNS ${ip}`).rejects.toThrow("nicht erlaubt");
    }
    for (const ip of open) {
      await expect(assertPublicHttpsUrl(`https://[${ip}]/v1`), `URL ${ip}`).resolves.toBeUndefined();
      lookupMock.mockResolvedValue([{ address: ip, family: 6 }]);
      await expect(assertPublicHttpsUrl("https://name.example/v1"), `DNS ${ip}`).resolves.toBeUndefined();
    }
  });
});

// Die Kennung eines Zählers (server/security/rate-limit.ts): IPv6 zählt je /64, sonst wäre jede Adresse eines
// Anschlusses ein frischer Zähler.
describe("addressBucket", () => {
  it.each([
    ["2001:db8:1:2:3:4:5:6", "2001:db8:1:2::/64"],
    ["2001:0DB8:0001:0002:ffff:ffff:ffff:ffff", "2001:db8:1:2::/64"],
    ["2001:db8:1:2::", "2001:db8:1:2::/64"],
    ["fe80::1%eth0", "fe80:0:0:0::/64"],
    ["::1", "0:0:0:0::/64"],
  ])("fasst %s zum /64-Netz %s zusammen", (ip, bucket) => {
    expect(addressBucket(ip)).toBe(bucket);
  });

  it("trennt benachbarte /64-Netze", () => {
    expect(addressBucket("2001:db8:1:2::1")).not.toBe(addressBucket("2001:db8:1:3::1"));
  });

  it.each(["::ffff:203.0.113.7", "::ffff:cb00:7107", "0:0:0:0:0:ffff:cb00:7107"])(
    "zählt die IPv4-gemappte Adresse %s wie die IPv4-Adresse",
    (ip) => {
      expect(addressBucket(ip)).toBe("203.0.113.7");
    }
  );

  it.each([
    "203.0.113.7",
    "unknown",
    "",
    // Keine gültige Form: bleibt, wie sie ist, statt in einem erfundenen Netz zu landen.
    "1::2::3",
    "1:2:3:4:5:6:7:8::1::2",
    "1:2:3",
    "1:2:3:4:5:6:7:8:9",
    "1:2:3:4::5:6:7:8",
    "zzzz::1",
    "1ffff::1",
  ])("lässt %j unverändert", (value) => {
    expect(addressBucket(value)).toBe(value);
  });
});
