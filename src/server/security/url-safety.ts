import "server-only";

import { promises as dns } from "node:dns";
import { isIP } from "node:net";

/**
 * Blocks SSRF through user-supplied URLs, specifically the BYOK "custom"
 * provider's baseUrl (settings) and every later call that fetches it
 * (src/lib/llm.ts's customComplete is the one call site, covering the
 * settings test-call, chat, and generate at once). Any signed-in account,
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

function isPrivateIPv6(ip: string): boolean {
  const n = ip.toLowerCase();
  if (n === "::1" || n === "::") return true; // loopback / unspecified
  if (/^f[cd][0-9a-f]{2}:/.test(n)) return true; // unique local fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(n)) return true; // link-local fe80::/10

  // IPv4-mapped IPv6 (::ffff:0:0/96). The embedded IPv4 can appear as a
  // dotted tail ("::ffff:127.0.0.1") as written, or, once WHATWG's URL host
  // parser normalizes it, as two hex groups ("::ffff:7f00:1", 127.0.0.1
  // packed into 0x7f00 0x0001), URL#hostname always returns the latter, so
  // both are checked.
  const dotted = n.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return isPrivateIPv4(dotted[1]);
  const hexMapped = n.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16);
    const lo = parseInt(hexMapped[2], 16);
    const quad = [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join(".");
    return isPrivateIPv4(quad);
  }

  return false;
}
