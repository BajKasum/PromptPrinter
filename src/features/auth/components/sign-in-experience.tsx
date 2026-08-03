"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { safeNextPath } from "@/shared/lib/site-url";
import { postAuthAction } from "@/shared/lib/auth-client";
import { AuthExperienceShell } from "@/features/auth/components/auth-experience-shell";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { TurnstileWidget, TURNSTILE_SITE_KEY } from "@/features/auth/components/turnstile-widget";
import { Input } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { SuccessCelebration } from "@/shared/brand/success-celebration";

// Login validates an EXISTING password, so it deliberately checks only that
// something was typed — no length rule (Security-Audit finding M-5).
//
// It used to require 8 characters here, which is a client-side lockout waiting
// to happen: Supabase's own default minimum is 6, so an account created under a
// looser policy could already be refused by this form while its password was
// still perfectly valid at the auth server. Raising the signup/reset minimum to
// MIN_PASSWORD_LENGTH would have widened that gap to every account with an
// 8- or 9-character password. A length rule on a login form protects nothing
// anyway — the credential either matches or it doesn't, and only Supabase can
// say which.
const schema = z.object({
  email: z.string().email("Bitte eine gültige Email eingeben"),
  password: z.string().min(1, "Bitte Passwort eingeben"),
});

/**
 * Login, right column of the two-column auth layout (Finn lives in the left
 * panel, see AuthExperienceShell): OAuth first (Google/GitHub), then email +
 * password, plus Cloudflare's human check when a Turnstile site key is
 * configured, with the dolphin success celebration.
 */
export function SignInExperience() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNextPath(search.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    search.get("error") === "auth_callback_failed"
      ? "Der Bestätigungs- oder Reset-Link ist ungültig oder abgelaufen. Bitte fordere unten einen neuen an."
      : null
  );
  const [celebrateMsg, setCelebrateMsg] = useState<string | null>(null);

  // Turnstile tokens are single-use, bump the nonce after any failed auth
  // call so the widget issues a fresh one for the retry.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const handleCaptchaToken = useCallback((t: string | null) => setCaptchaToken(t), []);
  const refreshCaptcha = useCallback(() => {
    setCaptchaToken(null);
    setCaptchaNonce((n) => n + 1);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
      return;
    }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError("Bitte bestätige kurz, dass du ein Mensch bist.");
      return;
    }

    setLoading(true);
    try {
      // Server-side (see lib/auth-client.ts): the Turnstile token is redeemed
      // in the same request that signs in, so it cannot be skipped from here.
      const result = await postAuthAction({ action: "sign-in", email, password }, captchaToken);
      if (!result.ok) {
        setError(result.message);
        // Tokens are single-use and one was just spent, successfully or not —
        // without a fresh one the retry fails as timeout-or-duplicate.
        refreshCaptcha();
        return;
      }
      setCelebrateMsg("Erfolgreich eingeloggt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthExperienceShell
      panelTitle="Schön, dass du wieder da bist."
      panelSub="Deine Ideen warten schon, tauchen wir wieder ein."
      overlay={
        celebrateMsg && (
          <SuccessCelebration
            message={celebrateMsg}
            onDone={() => {
              router.push(next);
              router.refresh();
            }}
          />
        )
      }
    >
      <div className="space-y-1.5">
        <h1 className="text-[2rem] font-bold leading-[1.1] tracking-tight text-foreground">
          Willkommen zurück
        </h1>
        <p className="text-[15px] font-light text-secondary">
          Melde dich in deinem PromptPrinter-Workspace an.
        </p>
      </div>

      <OAuthButtons next={next} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="block text-[13px] font-medium text-foreground">
            Email
          </label>
          <Input
            id="login-email"
            type="email"
            placeholder="du@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="login-password" className="text-[13px] font-medium text-foreground">
              Passwort
            </label>
            <Link
              href="/reset-password"
              className="text-[12.5px] text-tertiary transition-colors hover:text-foreground/80"
            >
              Passwort vergessen?
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <TurnstileWidget onToken={handleCaptchaToken} resetSignal={captchaNonce} />

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Einloggen
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p className="text-center text-[13px] text-secondary">
        Noch kein Konto?{" "}
        <Link href="/signup" className="text-accent-text hover:underline">
          Registrieren
        </Link>
      </p>
    </AuthExperienceShell>
  );
}
