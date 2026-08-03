import "server-only";

import { NextResponse } from "next/server";

// RFC 7807-ish error body, shared by every API route instead of each one
// carrying its own copy, two near-identical copies (chat + generate) had
// already drifted (chat was missing 401/404, generate was missing 502)
// before this existed. One status→title map, used everywhere.
const STATUS_TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  413: "Payload Too Large",
  429: "Too Many Requests",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

export function problem(status: number, detail: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      type: "about:blank",
      title: STATUS_TITLES[status] ?? "Error",
      status,
      detail,
      ...extra,
    },
    { status, headers: { "content-type": "application/problem+json" } }
  );
}
