"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as z from "@/shared/lib/zod";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { postAuthAction } from "@/shared/lib/auth-client";
import { AuthExperienceShell } from "@/features/auth/components/auth-experience-shell";
import { TurnstileWidget } from "@/shared/ui/turnstile-widget";
import { CAPTCHA_MISSING_MESSAGE, useTurnstile } from "@/shared/ui/use-turnstile";
import { FormError } from "@/shared/ui/form-error";
import { Input } from "@/shared/ui/input";
import { adoptPrefilledValue } from "@/features/auth/lib/prefilled-input";

const emailSchema = z.string().email("Bitte eine gültige Email eingeben");

/**
 * "Passwort vergessen", rechte Spalte der Auth-Hülle. Der Link zum Zurücksetzen läuft über /auth/callback, das auf die
 * Seite "Neues Passwort" weiterleitet. Mit Site-Key geht das Turnstile-Token mit.
 */
export function RequestPasswordResetExperience() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // Einmal nach dem Hydrieren: die Seite kommt statisch mit Formular, eine schon eingetragene Adresse kommt in den
  // State (lib/prefilled-input.ts).
  useEffect(() => {
    adoptPrefilledValue(emailRef.current, setEmail);
  }, []);

  const captcha = useTurnstile();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ungültige Email");
      return;
    }
    if (captcha.missing) {
      setError(CAPTCHA_MISSING_MESSAGE);
      return;
    }

    setLoading(true);
    try {
      const result = await postAuthAction({ action: "reset-password", email }, captcha.token);
      // Die Route antwortet immer gleich, auch im Mail-Cooldown und für eine unbekannte
      // Adresse. Hier landen nur noch das Limit je Adresse und eine fehlgeschlagene
      // Mensch-Prüfung, beide sagen nichts über das Konto.
      if (!result.ok) {
        setError(result.message);
        captcha.refresh();
        return;
      }
      setSent(true);
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
              wir einen Link zum Zurücksetzen gesendet. Prüfe auch deinen Spam-Ordner. Kommt nichts an,
              warte eine Minute und fordere den Link neu an.
            </p>
          </div>
          <p className="text-[13px] text-secondary">
            <Link href="/login" className="text-accent-text underline underline-offset-2">
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
            ref={emailRef}
            id="reset-email"
            type="email"
            placeholder="du@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <TurnstileWidget {...captcha.widgetProps} />

        <FormError>{error}</FormError>

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
        <Link href="/login" className="text-accent-text underline underline-offset-2">
          Einloggen
        </Link>
      </p>
    </AuthExperienceShell>
  );
}
