import "server-only";

import { promises as dns } from "node:dns";
import { isIP } from "node:net";

/**
 * Sperrt SSRF über Adressen, die ein Nutzer einträgt: die baseUrl des Custom-Anbieters (BYOK). Geprüft wird vor jeder
 * Anfrage dorthin, in server/llm/custom.ts (Chat und Test-Aufruf der Einstellungen) und in server/llm/analyze.ts
 * (Projekt-Gedächtnis). Jedes angemeldete Konto darf die Adresse setzen, der Server darf damit nie sein eigenes Netz
 * erreichen: Cloud-Metadaten (169.254.169.254), localhost, RFC1918 und Ähnliches.
 *
 * Aufgelöst wird der Name, geprüft jede Adresse, nicht nur die in der URL. `fetch` löst für die Verbindung erneut auf:
 * wer sein DNS selbst steuert, kann dazwischen den Eintrag wechseln (DNS-Rebinding). Das fängt diese Prüfung nicht ab,
 * die Verbindung ist nicht an die geprüfte Adresse gebunden.
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

/**
 * Der Modell-Endpunkt des Betreibers (`LLM_BASE_URL`, server/llm/config.ts). Er kommt aus der Umgebung, nicht aus einer
 * Eingabe, und gilt trotzdem nur im Einzelbetrieb (`selfHosted`, server/self-hosted.ts) als vertrauenswürdig: dann darf
 * er auf dem eigenen Rechner liegen (Ollama auf `http://localhost:11434/v1`), im eigenen Netz oder auf dem Docker-Host,
 * und http sprechen. Ohne Einzelbetrieb gilt dieselbe Prüfung wie für einen Endpunkt, den ein Nutzer einträgt.
 *
 * Endpunkte der Nutzer (BYOK) laufen nie hierüber, immer über `assertPublicHttpsUrl`: sonst könnte jedes Konto einer
 * eigenen Installation den Server Anfragen an das Netz des Betreibers schicken lassen.
 */
export async function assertServerEndpointUrl(rawUrl: string, selfHosted: boolean): Promise<void> {
  if (!selfHosted) return assertPublicHttpsUrl(rawUrl);
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Ungültige URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Nur http:// und https:// werden unterstützt.");
  }
}

function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // Unrecognized shape, fail closed.
}

/** Ein Netzbereich, zerlegt in die Gruppen seiner Adresse (IPv4: 4 zu 8 Bit, IPv6: 8 zu 16 Bit). */
type Range = { network: number[]; prefix: number };

function parseRange(cidr: string, toGroups: (address: string) => number[] | null): Range {
  const [address, prefix] = cidr.split("/");
  const network = toGroups(address);
  if (!network) throw new Error(`Ungültiger Netzbereich: ${cidr}`);
  return { network, prefix: Number(prefix) };
}

/** Der eine Vergleich für beide Adressarten: jede Gruppe liegt in dem Stück, das das Präfix ihr lässt. */
function inRange(address: number[], { network, prefix }: Range, groupBits: number): boolean {
  return network.every((group, i) => {
    // 1, wenn das Präfix die Gruppe ganz festlegt, 2^groupBits, wenn es sie nicht mehr erreicht.
    const span = 2 ** Math.min(Math.max((i + 1) * groupBits - prefix, 0), groupBits);
    const first = group - (group % span);
    return address[i] >= first && address[i] <= first + span - 1;
  });
}

const octets = (ip: string) => ip.split(".").map(Number);

const BLOCKED_IPV4 = [
  "0.0.0.0/8", // dieses Netz
  "10.0.0.0/8", // privat (RFC 1918)
  "100.64.0.0/10", // CGNAT (RFC 6598)
  "127.0.0.0/8", // Loopback
  "169.254.0.0/16", // Link-Local, darin die Metadaten der Cloud-Anbieter
  "172.16.0.0/12", // privat (RFC 1918)
  "192.0.0.0/24", // IETF-Protokollzuweisungen
  "192.0.2.0/24", // TEST-NET-1
  "192.168.0.0/16", // privat (RFC 1918)
  "198.18.0.0/15", // Benchmarks
  "198.51.100.0/24", // TEST-NET-2
  "203.0.113.0/24", // TEST-NET-3
  "224.0.0.0/3", // Multicast (224 bis 239), reserviert und Broadcast (240 bis 255)
].map((cidr) => parseRange(cidr, octets));

function isPrivateIPv4(ip: string): boolean {
  const parts = octets(ip);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  return BLOCKED_IPV4.some((range) => inRange(parts, range, 8));
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

/** Die IPv4-Adresse, die in zwei Gruppen einer IPv6-Adresse steht. */
const embeddedIPv4 = (hi: number, lo: number) => [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");

/**
 * Die Adresse als Kennung eines Zählers (server/security/rate-limit.ts): IPv6 als ihr /64-Netz, denn ein Anschluss bekommt
 * meist ein ganzes /64 und jede Adresse darin wäre sonst ein frischer Zähler. ::ffff:a.b.c.d zählt wie die IPv4-Adresse,
 * alles andere (IPv4, "unknown") bleibt, wie es ist.
 */
export function addressBucket(ip: string): string {
  const groups = ip.includes(":") ? ipv6Groups(ip) : null;
  if (!groups) return ip;
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return embeddedIPv4(groups[6], groups[7]);
  }
  return `${groups.slice(0, 4).map((g) => g.toString(16)).join(":")}::/64`;
}

const BLOCKED_IPV6 = [
  "fc00::/7", // Unique Local
  "fe80::/10", // Link-Local
  "fec0::/10", // Site-Local
  "ff00::/8", // Multicast
  "2001:db8::/32", // Dokumentation
  "100::/64", // Discard
  "64:ff9b:1::/48", // NAT64 für den lokalen Gebrauch
].map((cidr) => parseRange(cidr, ipv6Groups));

/**
 * Bereiche, deren Adressen eine IPv4-Adresse tragen und wie diese zählen; `at` ist die erste der beiden Gruppen, in
 * denen sie steht. ::/96 umfasst auch ::1 und ::, die als 0.0.0.1 und 0.0.0.0 in "dieses Netz" fallen.
 */
const IPV4_CARRIERS = (
  [
    ["::/96", 6], // IPv4-kompatibel
    ["::ffff:0:0/96", 6], // IPv4-gemappt
    ["64:ff9b::/96", 6], // NAT64
    ["2002::/16", 1], // 6to4
  ] as const
).map(([cidr, at]) => ({ range: parseRange(cidr, ipv6Groups), at }));

function isPrivateIPv6(ip: string): boolean {
  const groups = ipv6Groups(ip);
  if (!groups) return true; // Unrecognized shape, fail closed.
  if (BLOCKED_IPV6.some((range) => inRange(groups, range, 16))) return true;
  const carrier = IPV4_CARRIERS.find(({ range }) => inRange(groups, range, 16));
  return carrier ? isPrivateIPv4(embeddedIPv4(groups[carrier.at], groups[carrier.at + 1])) : false;
}
