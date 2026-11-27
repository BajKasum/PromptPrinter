"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as z from "@/shared/lib/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { postAuthAction } from "@/shared/lib/auth-client";
import { AuthExperienceShell } from "@/features/auth/components/auth-experience-shell";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { TurnstileWidget } from "@/shared/ui/turnstile-widget";
import { CAPTCHA_MISSING_MESSAGE, useTurnstile } from "@/shared/ui/use-turnstile";
import { FormError } from "@/shared/ui/form-error";
import { Input } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { SuccessCelebration } from "@/shared/brand/success-celebration";
import { locationSearchParam, nextPathFromLocation } from "@/features/auth/lib/location-search";
import { adoptPrefilledValue } from "@/features/auth/lib/prefilled-input";

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

// M-8 (Audit 06.09.2026): /auth/callback unterscheidet seither drei Faelle
// statt einem — vorher landete jeder Fehlschlag hier im selben
// "auth_callback_failed"-Satz, auch ein bei Google auf "Abbrechen" geklickter
// OAuth-Versuch, der weder einen Bestaetigungs- noch einen Reset-Link kennt
// und fuer den "fordere einen neuen an" keine sinnvolle Handlung ist.
function authCallbackErrorMessage(code: string | null): string | null {
  switch (code) {
    case "auth_callback_failed":
      return "Der Bestätigungs- oder Reset-Link ist ungültig oder abgelaufen. Bitte fordere unten einen neuen an.";
    case "oauth_cancelled":
      return "Die Anmeldung wurde abgebrochen. Du kannst es jederzeit erneut versuchen.";
    case "oauth_failed":
      return "Die Anmeldung hat nicht geklappt. Versuch es erneut, oder melde dich mit Email und Passwort an.";
    default:
      return null;
  }
}

/**
 * Login, right column of the two-column auth layout (Finn lives in the left
 * panel, see AuthExperienceShell): OAuth first (Google/GitHub), then email +
 * password, plus Cloudflare's human check when a Turnstile site key is
 * configured, with the dolphin success celebration.
 */
export function SignInExperience() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrateMsg, setCelebrateMsg] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Einmal nach dem Hydrieren: die Seite ist statisch gerendert, erst hier ist die Adresse bekannt
  // (lib/location-search.ts), und was vorher in den Feldern stand, kommt in den State (lib/prefilled-input.ts).
  useEffect(() => {
    adoptPrefilledValue(emailRef.current, setEmail);
    adoptPrefilledValue(passwordRef.current, setPassword);
    const callbackError = authCallbackErrorMessage(locationSearchParam("error"));
    if (callbackError) setError(callbackError);
  }, []);

  const captcha = useTurnstile();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
      return;
    }
    if (captcha.missing) {
      setError(CAPTCHA_MISSING_MESSAGE);
      return;
    }

    setLoading(true);
    try {
      // Das Token wird serverseitig in derselben Anfrage eingelöst, die anmeldet (shared/lib/auth-client.ts): von hier
      // aus lässt sich die Prüfung nicht überspringen.
      const result = await postAuthAction({ action: "sign-in", email, password }, captcha.token);
      if (!result.ok) {
        setError(result.message);
        captcha.refresh();
        return;
      }
      if (result.mfaRequired) {
        router.push(`/login/zweiter-faktor?next=${encodeURIComponent(nextPathFromLocation())}`);
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
              router.push(nextPathFromLocation());
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

      <OAuthButtons />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="block text-[13px] font-medium text-foreground">
            Email
          </label>
          <Input
            ref={emailRef}
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
            ref={passwordRef}
            id="login-password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
              Einloggen
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p className="text-center text-[13px] text-secondary">
        Noch kein Konto?{" "}
        <Link href="/signup" className="text-accent-text underline underline-offset-2">
          Registrieren
        </Link>
      </p>
    </AuthExperienceShell>
  );
}
