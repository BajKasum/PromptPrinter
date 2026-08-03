"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/shared/supabase/client";
import { safeNextPath } from "@/shared/lib/site-url";
import { postAuthAction } from "@/shared/lib/auth-client";
import { AuthExperienceShell } from "@/features/auth/components/auth-experience-shell";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { TurnstileWidget, TURNSTILE_SITE_KEY } from "@/features/auth/components/turnstile-widget";
import { Input } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { SuccessCelebration } from "@/shared/brand/success-celebration";
import { MIN_PASSWORD_LENGTH, PASSWORD_RULE_HINT } from "@/shared/lib/password";

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
  const search = useSearchParams();
  const next = safeNextPath(search.get("next"));
  // The pricing page's Pro button links here with ?plan=pro. That parameter
  // used to be read by nobody: the visitor clicked a paid plan, signed up, got
  // Free, and only found out that payment isn't live at all once they were past
  // the login and on the billing page (QA finding U-2). Acknowledged here
  // instead, and recorded as interest where a session allows it.
  const wantsPro = search.get("plan") === "pro";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [signupSent, setSignupSent] = useState(false);
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
      // Server-side (see lib/auth-client.ts): the Turnstile token is redeemed
      // in the same request that creates the account, so it cannot be skipped
      // from here.
      const result = await postAuthAction({ action: "sign-up", email, password, next }, captchaToken);
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
      // A session exists at this point, so the interest can be recorded right
      // away. When email confirmation is required the branch above returns
      // first and there is no session to write with — the notice on screen is
      // then all there is, which is still better than the parameter vanishing.
      if (wantsPro) await notePlanInterest();
      setCelebrateMsg("Konto erstellt");
    } finally {
      setLoading(false);
    }
  }

  // Records "this account came in through the Pro button" on the profile, so
  // the interest survives as something to act on when payment goes live rather
  // than as a lost click. profiles.settings is one of the three columns the
  // owner may write (migration 0014), best-effort: a failure here must never
  // cost someone their freshly created account.
  async function notePlanInterest() {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("settings")
        .eq("id", user.id)
        .maybeSingle();
      const current =
        profile?.settings && typeof profile.settings === "object" && !Array.isArray(profile.settings)
          ? (profile.settings as Record<string, unknown>)
          : {};
      await supabase
        .from("profiles")
        .update({ settings: { ...current, interested_in: "pro" } })
        .eq("id", user.id);
    } catch {
      // Interest is a nice-to-have, the account is not.
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
      const result = await postAuthAction({ action: "resend", email, next }, captchaToken);
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
      panelSub="Ich bin Finn. Erzähl mir deine Idee, ich mach einen fertigen Plan draus."
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
        <p className="text-[15px] font-light text-secondary">
          Kostenlos, keine Kreditkarte, jederzeit kündbar.
        </p>
      </div>

      {wantsPro && (
        <div className="rounded-lg border border-accent/30 bg-accent-subtle px-3.5 py-3 text-[13px] leading-relaxed text-accent-text">
          Du kommst über Pro. Bezahlung ist noch nicht freigeschaltet, dein Konto
          startet also auf Free, mit vollem Funktionsumfang über deinen eigenen
          API-Key. Ich merke dir Pro vor und melde mich, sobald es so weit ist.
        </div>
      )}

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

      <p className="text-center text-[13px] text-secondary">
        Schon ein Konto?{" "}
        <Link href="/login" className="text-accent-text hover:underline">
          Einloggen
        </Link>
      </p>
    </AuthExperienceShell>
  );
}
