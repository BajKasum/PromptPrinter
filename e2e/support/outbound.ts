import { existsSync, readFileSync } from "node:fs";
import { outboundLogPath } from "./env";

// Was der Server an die nachgestellten Dienste geschickt hat (support/outbound-fakes.cjs).

export type OutboundRequest = { host: string; method: string; path: string; status: number; body: string };

export function outboundRequests(host: string): OutboundRequest[] {
  const file = outboundLogPath();
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OutboundRequest)
    .filter((request) => request.host === host);
}
