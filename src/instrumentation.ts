// Runs once per server start (Next.js instrumentation hook). The only thing
// wired up here is the environment check from QA finding S-2, so a deployment
// that is missing something load-bearing says so at boot instead of failing at
// the first signed-in request with an unrelated-looking error.
export async function register() {
  // The hook also runs on the edge runtime, where process.env is a different,
  // smaller surface and this check would be misleading. Node only.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertEnv } = await import("@/lib/env");
  assertEnv();
}
