"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { siteUrl, safeNextPath } from "@/lib/site-url";
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
 * Signup, right column of the two-column auth layout (Finn lives in the
 * left panel, see AuthExperienceShell): OAuth first (Google/GitHub), then
 * email + password with an explicit terms checkbox and — when a Turnstile
 * site key is configured — Cloudflare's human check. The email-confirmation
 * state and the dolphin celebration for instant sessions stay as before.
 */
export function SignUpExperience() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNextPath(search.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [signupSent, setSignupSent] = useState(false);
  const [celebrateMsg, setCelebrateMsg] = useState<string | null>(null);

  // Turnstile tokens are single-use — bump the nonce after any failed auth
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
    if (!termsAccepted) {
      setError("Bitte akzeptiere zuerst die AGB und die Datenschutzerklärung.");
      return;
    }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError("Bitte bestätige kurz, dass du ein Mensch bist.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: siteUrl(`/auth/callback?next=${encodeURIComponent(next)}`),
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      if (signUpError) {
        setError(translateAuthError(signUpError.message));
        refreshCaptcha();
        return;
      }
      // Email-confirmation on → no session yet; tell the user to check their inbox.
      if (!data.session) {
        refreshCaptcha();
        setSignupSent(true);
        return;
      }
      setCelebrateMsg("Konto erstellt");
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : "Unbekannter Fehler");
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError("Bitte bestätige kurz, dass du ein Mensch bist.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: siteUrl(`/auth/callback?next=${encodeURIComponent(next)}`),
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      if (resendError) setError(translateAuthError(resendError.message));
      else setInfo("Bestätigungs-Email wurde erneut gesendet.");
      refreshCaptcha();
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : "Unbekannter Fehler");
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  }

  if (signupSent) {
    return (
      <AuthExperienceShell
        panelTitle="Fast geschafft."
        panelSub="Ein Klick auf den Link in deiner Mail, und wir legen los."
      >
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-success/30 bg-success/10">
            <MailCheck className="h-7 w-7 text-success" strokeWidth={1.8} />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-[2rem] font-bold leading-[1.1] tracking-tight text-foreground">
              Email unterwegs
            </h1>
            <p className="text-[15px] font-light text-foreground/60">
              Wir haben einen Bestätigungs-Link an <span className="text-foreground">{email}</span>{" "}
              geschickt. Klick darauf, um dein Konto zu aktivieren.
            </p>
          </div>

          {info && (
            <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-[13px] text-success">
              {info}
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive"
            >
              {error}
            </div>
          )}

          <div className="flex justify-center">
            <TurnstileWidget onToken={handleCaptchaToken} resetSignal={captchaNonce} />
          </div>

          <button
            type="button"
            onClick={handleResend}
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Email erneut senden
          </button>

          <p className="text-[13px] text-foreground/55">
            Schon bestätigt?{" "}
            <Link href="/login" className="text-accent-text hover:underline">
              Einloggen
            </Link>
          </p>
        </div>
      </AuthExperienceShell>
    );
  }

  return (
    <AuthExperienceShell
      panelTitle="Schön, dass du da bist."
      panelSub="Ich bin Finn. Erzähl mir deine Idee — ich mach einen fertigen Plan draus."
      overlay={
        celebrateMsg && (
          <SuccessCelebration
            message={celebrateMsg}
            description="Schön, dass du da bist."
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
          Konto erstellen
        </h1>
        <p className="text-[15px] font-light text-foreground/60">
          Kostenlos, keine Kreditkarte, jederzeit kündbar.
        </p>
      </div>

      <OAuthButtons next={next} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="signup-email" className="block text-[13px] font-medium text-foreground">
            Email
          </label>
          <Input
            id="signup-email"
            type="email"
            placeholder="du@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="signup-password"
            className="block text-[13px] font-medium text-foreground"
          >
            Passwort
          </label>
          <PasswordInput
            id="signup-password"
            placeholder="Passwort (mind. 8 Zeichen)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-foreground/70">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
          />
          <span>
            Ich habe die{" "}
            <Link href="/agb" className="text-accent-text hover:underline">
              AGB
            </Link>{" "}
            und die{" "}
            <Link href="/datenschutz" className="text-accent-text hover:underline">
              Datenschutzerklärung
            </Link>{" "}
            gelesen und akzeptiere sie.
          </span>
        </label>

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
              Konto erstellen
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p className="text-center text-[13px] text-foreground/55">
        Schon ein Konto?{" "}
        <Link href="/login" className="text-accent-text hover:underline">
          Einloggen
        </Link>
      </p>
    </AuthExperienceShell>
  );
}
