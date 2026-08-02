/**
 * Browser-side wrapper around POST /api/auth.
 *
 * The auth forms used to call Supabase directly and each carried its own copy
 * of the error handling. They now post here instead, so the Turnstile token is
 * redeemed server-side in the same request that performs the action (see
 * app/api/auth/route.ts for why that ordering is the whole point). Keeping the
 * fetch in one place stops three forms from drifting apart on how they read a
 * problem+json body.
 */

export type AuthActionRequest =
  | { action: "sign-in"; email: string; password: string }
  | { action: "sign-up"; email: string; password: string; next?: string }
  | { action: "resend"; email: string; next?: string }
  | { action: "reset-password"; email: string };

export type AuthActionResult =
  /** `session` only means something for sign-up: false = confirmation mail sent. */
  | { ok: true; session: boolean }
  | { ok: false; message: string; captchaFailed: boolean };

export async function postAuthAction(
  request: AuthActionRequest,
  turnstileToken: string | null
): Promise<AuthActionResult> {
  let res: Response;
  try {
    res = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...request, turnstileToken: turnstileToken ?? undefined }),
    });
  } catch {
    // Offline, DNS, connection reset — never a rejected credential, so it gets
    // its own wording rather than being folded into the server's messages.
    return {
      ok: false,
      message: "Keine Verbindung zum Server. Bitte prüf deine Verbindung und versuch es erneut.",
      captchaFailed: false,
    };
  }

  const payload = (await res.json().catch(() => null)) as {
    session?: boolean;
    detail?: string;
    kind?: string;
  } | null;

  if (!res.ok) {
    return {
      ok: false,
      message: payload?.detail ?? "Unbekannter Fehler. Bitte versuch es erneut.",
      captchaFailed: payload?.kind === "captcha",
    };
  }

  // Absent for every action except sign-up, where the server states it
  // explicitly. Defaulting to true keeps "proceed" the meaning everywhere else.
  return { ok: true, session: payload?.session ?? true };
}
