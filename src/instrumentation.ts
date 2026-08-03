// Runs once per server start (Next.js instrumentation hook). The only thing
// wired up here is the environment check from QA finding S-2, so a deployment
// that is missing something load-bearing says so at boot instead of failing at
// the first signed-in request with an unrelated-looking error.
export async function register() {
  // The hook also runs on the edge runtime, where process.env is a different,
  // smaller surface and this check would be misleading. Node only.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertEnv } = await import("@/server/env");
  assertEnv();

  // Hängt den Webhook-Versand an die Logging-Naht (observability.ts).
  //
  // Das passiert hier statt per Top-Level-Import in observability.ts, weil
  // dieses Modul isomorph ist: (app)/error.tsx meldet Client-Abstürze durch
  // dieselbe Funktion. Ein statischer Import zog @upstash/redis in einen
  // 71,7-KB-Client-Chunk für Code, der ohne Server-Env ohnehin nichts tut.
  // Registriert wird deshalb nur dort, wo der Sink auch feuern kann — auf dem
  // Node-Server, einmal pro Start (bzw. pro Cold Start).
  const [{ registerAlertSink }, { dispatchAlert }] = await Promise.all([
    import("@/shared/lib/observability"),
    import("@/server/observability/alerting"),
  ]);
  registerAlertSink((level, event, context) => void dispatchAlert(level, event, context));
}
