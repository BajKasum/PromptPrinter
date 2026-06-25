"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { AuthExperienceShell } from "@/components/auth/auth-experience-shell";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { SuccessCelebration } from "@/components/brand/success-celebration";

const schema = z.object({
  email: z.string().email("Bitte eine gültige Email eingeben"),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
});

/**
 * Full-bleed login: the shared animated backdrop behind a dark, glassy
 * email + password form wired to Supabase, with the dolphin success celebration.
 */
export function SignInExperience() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    search.get("error") === "auth_callback_failed"
      ? "Der Bestätigungs- oder Reset-Link ist ungültig oder abgelaufen. Bitte fordere unten einen neuen an."
      : null
  );
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
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(translateAuthError(signInError.message));
        return;
      }
      setCelebrateMsg("Erfolgreich eingeloggt");
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthExperienceShell
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
      <div className="flex justify-center">
        <AnimatedMascot state="welcoming" size={88} alt="Finn freut sich, dich wiederzusehen" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-[2.25rem] font-bold leading-[1.1] tracking-tight text-foreground">
          Willkommen zurück
        </h1>
        <p className="text-[15px] font-light text-foreground/60">
          Melde dich in deinem PromptPrinter-Workspace an.
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
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
              Einloggen
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>

        <div className="text-right">
          <Link
            href="/reset-password"
            className="text-[12.5px] text-foreground/50 transition-colors hover:text-foreground/80"
          >
            Passwort vergessen?
          </Link>
        </div>
      </form>

      <p className="text-[13px] text-foreground/55">
        Noch kein Konto?{" "}
        <Link href="/signup" className="text-foreground hover:underline">
          Registrieren
        </Link>
      </p>
    </AuthExperienceShell>
  );
}
