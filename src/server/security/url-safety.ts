import "server-only";

import { promises as dns } from "node:dns";
import { isIP } from "node:net";

/**
 * Blocks SSRF through user-supplied URLs, specifically the BYOK "custom"
 * provider's baseUrl (settings) and every later call that fetches it
 * (src/server/llm/custom.ts is the one call site for the endpoint itself,
 * covering the settings test-call and chat at once). Any signed-in account,
 * even Free, can set this URL and have the server POST to it, so it must
 * never be able to reach the server's own private network: cloud metadata
 * (169.254.169.254), localhost, RFC1918 ranges, etc.
 *
 * Resolves the hostname and checks every returned address, not just the
 * literal host in the URL, so a public-looking hostname that resolves to a
 * private address is caught too. Node's fetch resolves the hostname again
 * for the actual connection; an attacker controlling their own DNS could in
 * principle swap the record between this check and the real request (DNS
 * rebinding). This closes the practical, common case (metadata endpoints,
 * localhost, RFC1918 ranges) at proportionate cost for this project, not a
 * fully rebinding-proof pinned-connection setup.
 */
export async function assertPublicHttpsUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Ungültige URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Nur https:// wird unterstützt.");
  }

  const hostname = url.hostname.toLowerCase();
  // IPv6 literals keep their brackets in URL#hostname ("[::1]"), strip them
  // before treating the value as a bare address.
  const bareHost =
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;

  if (bareHost === "localhost" || bareHost.endsWith(".localhost")) {
    throw new Error("Diese Adresse ist nicht erlaubt.");
  }

  // A literal IP in the URL, check directly, no DNS round trip needed.
  if (isIP(bareHost)) {
    if (isPrivateOrReservedIp(bareHost)) {
      throw new Error("Diese Adresse ist nicht erlaubt.");
    }
    return;
  }

  let records: { address: string }[];
  try {
    records = await dns.lookup(bareHost, { all: true, verbatim: true });
  } catch {
    throw new Error("Adresse konnte nicht aufgelöst werden.");
  }
  if (records.length === 0) {
    throw new Error("Adresse konnte nicht aufgelöst werden.");
  }
  for (const { address } of records) {
    if (isPrivateOrReservedIp(address)) {
      throw new Error("Diese Adresse ist nicht erlaubt.");
    }
  }
}

function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // Unrecognized shape, fail closed.
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = parts;
  if (a === 0) return true; // "this" network
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC6598)
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast (224-239) + reserved/broadcast (240-255)
  return false;
}

/**
 * Die acht 16-Bit-Gruppen einer IPv6-Adresse, oder null, wenn die Form nicht stimmt. Die
 * Bereiche werden auf den Zahlen geprüft, nicht auf dem Text: dieselbe Adresse lässt sich
 * mehrfach schreiben ("::ffff:127.0.0.1", "::ffff:7f00:1", "0:0:0:0:0:ffff:7f00:1").
 */
function ipv6Groups(ip: string): number[] | null {
  let n = ip.toLowerCase().split("%")[0];
  const dotted = n.match(/^(.*:)(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(2).map(Number);
    n = `${dotted[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const sides = n.split("::");
  if (sides.length > 2) return null;
  const toGroups = (side: string) => (side ? side.split(":").map((g) => parseInt(g, 16)) : []);
  const head = toGroups(sides[0]);
  const tail = sides.length === 2 ? toGroups(sides[1]) : [];
  const missing = 8 - head.length - tail.length;
  if (sides.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...new Array<number>(missing).fill(0), ...tail];
  return groups.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff) ? null : groups;
}

/**
 * Die Adresse als Kennung eines Zählers (server/security/rate-limit.ts): IPv6 als ihr /64-Netz, denn ein Anschluss bekommt
 * meist ein ganzes /64 und jede Adresse darin wäre sonst ein frischer Zähler. ::ffff:a.b.c.d zählt wie die IPv4-Adresse,
 * alles andere (IPv4, "unknown") bleibt, wie es ist.
 */
export function addressBucket(ip: string): string {
  const groups = ip.includes(":") ? ipv6Groups(ip) : null;
  if (!groups) return ip;
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
  }
  return `${groups.slice(0, 4).map((g) => g.toString(16)).join(":")}::/64`;
}

function isPrivateIPv6(ip: string): boolean {
  const g = ipv6Groups(ip);
  if (!g) return true; // Unrecognized shape, fail closed.
  const embedded = (hi: number, lo: number) =>
    isPrivateIPv4([(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join("."));
  const zeros = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);

  if ((g[0] & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((g[0] & 0xffc0) === 0xfec0) return true; // site-local fec0::/10
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast ff00::/8
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation 2001:db8::/32
  if (g[0] === 0x0100 && zeros(1, 4)) return true; // discard 100::/64
  if (g[0] === 0x0064 && g[1] === 0xff9b && g[2] === 1) return true; // local-use NAT64 64:ff9b:1::/48

  // Adressen, die eine IPv4-Adresse tragen, zählen wie diese. ::/96 umfasst auch ::1 und ::,
  // die als 0.0.0.1 und 0.0.0.0 im "this network" landen.
  if (zeros(0, 6)) return embedded(g[6], g[7]); // IPv4-compatible ::/96
  if (zeros(0, 5) && g[5] === 0xffff) return embedded(g[6], g[7]); // IPv4-mapped ::ffff:0:0/96
  if (g[0] === 0x0064 && g[1] === 0xff9b && zeros(2, 6)) return embedded(g[6], g[7]); // NAT64 64:ff9b::/96
  if (g[0] === 0x2002) return embedded(g[1], g[2]); // 6to4 2002::/16

  return false;
}
