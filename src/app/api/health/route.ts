import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liveness/readiness probe (Security-Audit finding M-4). docker-compose's
// healthcheck used to GET "/", which is the marketing page: it renders fine
// from static output even when Supabase is unreachable, so a container could
// report healthy while nothing a signed-in user does actually works.
//
// Deliberately UNAUTHENTICATED and deliberately uninformative. An uptime
// checker has no session, so a gate would defeat the purpose — which means the
// response must not become a reconnaissance endpoint either. It reports only
// whether the process is up and whether its load-bearing configuration is
// present, never versions, never hostnames, never which provider is in use, and
// never why something is missing.
//
// No network calls: this must stay cheap enough to poll every few seconds, and
// a probe that pings Supabase on every request would turn an uptime monitor
// into a load generator (and would fail the container over a transient upstream
// blip, which is the opposite of useful).
const REQUIRED_FOR_SIGNED_IN_USE = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

export function GET() {
  const configured = REQUIRED_FOR_SIGNED_IN_USE.every(
    (name) => (process.env[name] ?? "").trim() !== ""
  );

  // 503 rather than a 200 carrying {status:"degraded"}: an uptime monitor and a
  // container healthcheck both act on the status code, and a misconfigured
  // deployment should fail the probe rather than report success in the body.
  return NextResponse.json(
    { status: configured ? "ok" : "degraded" },
    {
      status: configured ? 200 : 503,
      headers: { "cache-control": "no-store" },
    }
  );
}
