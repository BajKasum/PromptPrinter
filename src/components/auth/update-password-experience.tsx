"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthExperienceShell } from "@/components/auth/auth-experience-shell";
import { SuccessCelebration } from "@/components/brand/success-celebration";

function translatePasswordError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("different from the old") || m.includes("should be different"))
    return "Das neue Passwort muss sich vom alten unterscheiden.";
  if (m.includes("password should be")) return "Passwort zu schwach (mindestens 8 Zeichen).";
  if (m.includes("rate limit")) return "Zu viele Versuche — bitte kurz warten.";
  if (m.includes("session") || m.includes("expired") || m.includes("jwt"))
    return "Die Sitzung ist abgelaufen. Fordere den Link bitte erneut an.";
  return message;
}

/**
 * Full-bleed "set a new password" screen — same animated backdrop as login. The
 * recovery session is already established by the callback; on success the dolphin
 * celebration plays and we land in the app.
 */
export function UpdatePasswordExperience({ email }: { email: string }) {
  const router = useRouter();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (next.length < 8) {
      setError("Das neue Passwort braucht mindestens 8 Zeichen.");
      return;
    }
    if (next !== confirm) {
      setError("Die beiden Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        setError(translatePasswordError(updateError.message));
        return;
      }
      setCelebrate(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthExperienceShell
      overlay={
        celebrate && (
          <SuccessCelebration
            message="Passwort aktualisiert"
            onDone={() => {
              router.push("/dashboard");
              router.refresh();
            }}
          />
        )
      }
    >
      <div className="space-y-1.5">
        <h1 className="text-[2.25rem] font-bold leading-[1.1] tracking-tight text-foreground">
          Neues Passwort setzen
        </h1>
        <p className="text-[15px] font-light text-foreground/60">
          Wähle ein neues Passwort für <span className="text-foreground">{email}</span>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Neues Passwort (mind. 8 Zeichen)"
            value={next}
            onChange={(e) => setNext(e.target.value)}
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

        <input
          type={showPassword ? "text" : "password"}
          placeholder="Passwort wiederholen"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          className="w-full rounded-full border border-foreground/10 bg-foreground/5 px-5 py-3 text-center text-foreground backdrop-blur-[1px] transition-colors placeholder:text-foreground/40 focus:border-foreground/30 focus:outline-none"
        />

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
              Passwort speichern
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>
    </AuthExperienceShell>
  );
}
