"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/site-url";
import { translateAuthError } from "@/lib/auth-errors";
import { AuthExperienceShell } from "@/components/auth/auth-experience-shell";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { TurnstileWidget, TURNSTILE_SITE_KEY } from "@/components/auth/turnstile-widget";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SuccessCelebration } from "@/components/brand/success-celebration";

const schema = z.object({
  email: z.string().email("Bitte eine gültige Email eingeben"),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
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
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      });
      if (signInError) {
        setError(translateAuthError(signInError.message));
        refreshCaptcha();
        return;
      }
      setCelebrateMsg("Erfolgreich eingeloggt");
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : "Unbekannter Fehler");
      refreshCaptcha();
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
