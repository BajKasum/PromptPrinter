"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as z from "@/shared/lib/zod";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { postAuthAction } from "@/shared/lib/auth-client";
import { AuthExperienceShell } from "@/features/auth/components/auth-experience-shell";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { TurnstileWidget, TURNSTILE_SITE_KEY } from "@/shared/ui/turnstile-widget";
import { Input } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { SuccessCelebration } from "@/shared/brand/success-celebration";
import { nextPathFromLocation } from "@/features/auth/lib/location-search";
import { adoptPrefilledCheck, adoptPrefilledValue } from "@/features/auth/lib/prefilled-input";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_RULE_HINT,
  weakPasswordMessage,
  weakPasswordReason,
} from "@/shared/lib/password";

const schema = z.object({
  email: z.string().email("Bitte eine gültige Email eingeben"),
  password: z.string().min(MIN_PASSWORD_LENGTH, PASSWORD_RULE_HINT),
});

/**
 * Signup, right column of the two-column auth layout (Finn lives in the
 * left panel, see AuthExperienceShell): OAuth first (Google/GitHub), then
 * email + password with an explicit terms checkbox and, when a Turnstile
 * site key is configured, Cloudflare's human check. The email-confirmation
 * state and the dolphin celebration for instant sessions stay as before.
 */
export function SignUpExperience() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [signupSent, setSignupSent] = useState(false);
  const [celebrateMsg, setCelebrateMsg] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);

  // Einmal nach dem Hydrieren: was schon in den Feldern stand, kommt in den State (lib/prefilled-input.ts).
  useEffect(() => {
    adoptPrefilledValue(emailRef.current, setEmail);
    adoptPrefilledValue(passwordRef.current, setPassword);
    adoptPrefilledCheck(termsRef.current, setTermsAccepted);
  }, []);

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
    // Vor dem Captcha und vor dem Netz: der Token ist einmalig gültig, ein
    // abgelehntes Passwort soll ihn nicht verbrennen. Die Route prüft dasselbe
    // noch einmal, das hier ist nur die schnelle Rückmeldung.
    const weak = weakPasswordReason(password, email);
    if (weak) {
      setError(weakPasswordMessage(weak));
      return;
    }
    if (!termsAccepted) {
      setError("Bitte akzeptiere zuerst die AGB.");
      return;
    }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError("Bitte bestätige kurz, dass du ein Mensch bist.");
      return;
    }

    setLoading(true);
    try {
      // Server-side (see lib/auth-client.ts): the Turnstile token is redeemed
      // in the same request that creates the account, so it cannot be skipped
      // from here.
      const result = await postAuthAction({ action: "sign-up", email, password, next: nextPathFromLocation() }, captchaToken);
      if (!result.ok) {
        setError(result.message);
        // Tokens are single-use and one was just spent, successfully or not —
        // without a fresh one the retry fails as timeout-or-duplicate.
        refreshCaptcha();
        return;
      }
      // Email-confirmation on → no session yet; tell the user to check their inbox.
      if (!result.session) {
        refreshCaptcha();
        setSignupSent(true);
        return;
      }
      setCelebrateMsg("Konto erstellt");
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
      const result = await postAuthAction({ action: "resend", email, next: nextPathFromLocation() }, captchaToken);
      if (!result.ok) setError(result.message);
      else setInfo("Bestätigungs-Email wurde erneut gesendet.");
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
            <p className="text-[15px] font-light text-secondary">
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

          <p className="text-[13px] text-secondary">
            Schon bestätigt?{" "}
            <Link href="/login" className="text-accent-text underline underline-offset-2">
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
      panelSub="Ich bin Finn. Erzähl mir deine Idee, ich mach einen fertigen Prompt draus."
      overlay={
        celebrateMsg && (
          <SuccessCelebration
            message={celebrateMsg}
            description="Schön, dass du da bist."
            onDone={() => {
              router.push(nextPathFromLocation());
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
        <p className="text-[15px] font-light text-secondary">
          Kostenlos und Open Source. Drei Prompts gehen auf mich, danach chattest du mit einem eigenen KI-Key, am
          einfachsten einem kostenlosen von Google. Den holst du dir im Chat.
        </p>
      </div>

      <OAuthButtons />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="signup-email" className="block text-[13px] font-medium text-foreground">
            Email
          </label>
          <Input
            ref={emailRef}
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
            ref={passwordRef}
            id="signup-password"
            placeholder={`Passwort (mind. ${MIN_PASSWORD_LENGTH} Zeichen)`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-foreground/70">
          <input
            ref={termsRef}
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
          />
          {/* Nur die AGB werden akzeptiert. Die Datenschutzerklärung ist eine
              Information, kein Vertrag: sie "akzeptieren" zu lassen, erweckt
              den Eindruck einer Einwilligung, obwohl die Bearbeitung auf dem
              Nutzungsvertrag beruht (Rechts-Audit 28.09.2026). */}
          <span>
            Ich akzeptiere die{" "}
            <Link href="/agb" className="text-accent-text underline underline-offset-2">
              AGB
            </Link>
            . Die{" "}
            <Link href="/datenschutz" className="text-accent-text underline underline-offset-2">
              Datenschutzerklärung
            </Link>{" "}
            habe ich zur Kenntnis genommen.
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

      <p className="text-center text-[13px] text-secondary">
        Schon ein Konto?{" "}
        <Link href="/login" className="text-accent-text underline underline-offset-2">
          Einloggen
        </Link>
      </p>
    </AuthExperienceShell>
  );
}
