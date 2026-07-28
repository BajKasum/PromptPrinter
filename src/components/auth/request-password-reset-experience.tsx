"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { siteUrl } from "@/lib/site-url";
import { AuthExperienceShell } from "@/components/auth/auth-experience-shell";
import { TurnstileWidget, TURNSTILE_SITE_KEY } from "@/components/auth/turnstile-widget";
import { Input } from "@/components/ui/input";

const emailSchema = z.string().email("Bitte eine gültige Email eingeben");

/**
 * "Request password reset", right column of the two-column auth layout.
 * Sends the recovery link through the shared /auth/callback, which forwards
 * to the password-update page. Carries the Turnstile token when configured,
 * Supabase enforces the captcha on this endpoint too once it's enabled.
 */
export function RequestPasswordResetExperience() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const handleCaptchaToken = useCallback((t: string | null) => setCaptchaToken(t), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ungültige Email");
      return;
    }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError("Bitte bestätige kurz, dass du ein Mensch bist.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: siteUrl("/auth/callback?next=/reset-password/update"),
        ...(captchaToken ? { captchaToken } : {}),
      });
      // Only surface rate-limiting; otherwise stay neutral so we never reveal
      // whether an email is registered.
      if (resetError && resetError.message.toLowerCase().includes("rate limit")) {
        setError("Zu viele Versuche, bitte kurz warten.");
        setCaptchaToken(null);
        setCaptchaNonce((n) => n + 1);
        return;
      }
      setSent(true);
    } catch {
      setError("Unbekannter Fehler. Bitte versuche es erneut.");
      setCaptchaToken(null);
      setCaptchaNonce((n) => n + 1);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthExperienceShell
        panelTitle="Kriegen wir wieder hin."
        panelSub="Ein neuer Link, ein neues Passwort, und du bist wieder drin."
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
              Falls ein Konto mit <span className="text-foreground">{email}</span> existiert, haben
              wir einen Link zum Zurücksetzen gesendet. Prüfe auch deinen Spam-Ordner.
            </p>
          </div>
          <p className="text-[13px] text-secondary">
            <Link href="/login" className="text-accent-text hover:underline">
              Zurück zum Login
            </Link>
          </p>
        </div>
      </AuthExperienceShell>
    );
  }

  return (
    <AuthExperienceShell
      panelTitle="Kriegen wir wieder hin."
      panelSub="Ein neuer Link, ein neues Passwort, und du bist wieder drin."
    >
      <div className="space-y-1.5">
        <h1 className="text-[2rem] font-bold leading-[1.1] tracking-tight text-foreground">
          Passwort vergessen?
        </h1>
        <p className="text-[15px] font-light text-secondary">
          Gib deine Email ein, wir senden dir einen Link zum Zurücksetzen.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="reset-email" className="block text-[13px] font-medium text-foreground">
            Email
          </label>
          <Input
            id="reset-email"
            type="email"
            placeholder="du@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
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
              Link senden
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p className="text-center text-[13px] text-secondary">
        Doch erinnert?{" "}
        <Link href="/login" className="text-accent-text hover:underline">
          Einloggen
        </Link>
      </p>
    </AuthExperienceShell>
  );
}
