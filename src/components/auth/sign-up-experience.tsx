"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { ArrowRight, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { siteUrl } from "@/lib/site-url";
import { translateAuthError } from "@/lib/auth-errors";
import { AuthExperienceShell } from "@/components/auth/auth-experience-shell";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { SuccessCelebration } from "@/components/brand/success-celebration";

const schema = z.object({
  email: z.string().email("Bitte eine gültige Email eingeben"),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
});

/**
 * Full-bleed signup: same animated backdrop as the login, with the real
 * Supabase sign-up flow — including the email-confirmation state and the dolphin
 * celebration when a session is returned immediately.
 */
export function SignUpExperience() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [signupSent, setSignupSent] = useState(false);
  const [celebrateMsg, setCelebrateMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: siteUrl(`/auth/callback?next=${encodeURIComponent(next)}`) },
      });
      if (signUpError) {
        setError(translateAuthError(signUpError.message));
        return;
      }
      // Email-confirmation on → no session yet; tell the user to check their inbox.
      if (!data.session) {
        setSignupSent(true);
        return;
      }
      setCelebrateMsg("Konto erstellt");
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: siteUrl(`/auth/callback?next=${encodeURIComponent(next)}`) },
      });
      if (resendError) setError(translateAuthError(resendError.message));
      else setInfo("Bestätigungs-Email wurde erneut gesendet.");
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  if (signupSent) {
    return (
      <AuthExperienceShell>
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
          <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-2.5 text-[13px] text-success">
            {info}
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive"
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 py-3 font-medium text-foreground transition-colors hover:bg-foreground/10 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Email erneut senden
        </button>

        <p className="text-[13px] text-foreground/55">
          Schon bestätigt?{" "}
          <Link href="/login" className="text-foreground hover:underline">
            Einloggen
          </Link>
        </p>
      </AuthExperienceShell>
    );
  }

  return (
    <AuthExperienceShell
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
      <div className="flex justify-center">
        <AnimatedMascot state="welcoming" size={88} alt="Finn freut sich auf dich" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-[2.25rem] font-bold leading-[1.1] tracking-tight text-foreground">
          Loslegen
        </h1>
        <p className="text-[15px] font-light text-foreground/60">
          Kostenlos, keine Kreditkarte, jederzeit kündbar.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          placeholder="du@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="w-full rounded-full border border-foreground/10 bg-foreground/5 px-5 py-3 text-center text-foreground backdrop-blur-[1px] transition-colors placeholder:text-foreground/40 focus:border-foreground/30 focus:outline-none"
        />

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Passwort (mind. 8 Zeichen)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            className="w-full rounded-full border border-foreground/10 bg-foreground/5 px-5 py-3 text-center text-foreground backdrop-blur-[1px] transition-colors placeholder:text-foreground/40 focus:border-foreground/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40 transition-colors hover:text-foreground/70"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
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

      <p className="text-[13px] text-foreground/55">
        Schon ein Konto?{" "}
        <Link href="/login" className="text-foreground hover:underline">
          Einloggen
        </Link>
      </p>
    </AuthExperienceShell>
  );
}
