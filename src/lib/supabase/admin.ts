import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. It bypasses Row Level Security, so it must
 * NEVER reach the browser. Two things keep it server-only:
 *   1. SUPABASE_SERVICE_ROLE_KEY is not a NEXT_PUBLIC_ var, so Next never
 *      bundles it into client code — a client import would get `undefined`.
 *   2. The window guard below turns any accidental client-side call into a
 *      loud error instead of a silent misconfiguration.
 *
 * Only import this from server-side code (route handlers / server actions).
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() must never run in the browser.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin credentials.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
