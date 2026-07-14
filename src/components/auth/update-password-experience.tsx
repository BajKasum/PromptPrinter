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
  if (m.includes("rate limit")) return "Zu viele Versuche, bitte kurz warten.";
  if (m.includes("session") || m.includes("expired") || m.includes("jwt"))
    return "Die Sitzung ist abgelaufen. Fordere den Link bitte erneut an.";
  return message;
}

/**
 * Full-bleed "set a new password" screen, same animated backdrop as login. The
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

  const inputClasses =
    "h-11 w-full rounded-lg border border-border bg-surface px-3.5 pr-11 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-200 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";

  return (
    <AuthExperienceShell
      panelTitle="Kriegen wir wieder hin."
      panelSub="Neues Passwort setzen, und du bist wieder drin."
      overlay={
        celebrate && (
          <SuccessCelebration
            message="Passwort aktualisiert"
            onDone={() => {
              router.push("/chats/new");
              router.refresh();
            }}
          />
        )
      }
    >
      <div className="space-y-1.5">
        <h1 className="text-[2rem] font-bold leading-[1.1] tracking-tight text-foreground">
          Neues Passwort setzen
        </h1>
        <p className="text-[15px] font-light text-foreground/60">
          Wähle ein neues Passwort für <span className="text-foreground">{email}</span>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="new-password" className="block text-[13px] font-medium text-foreground">
            Neues Passwort
          </label>
          {/* One shared visibility toggle for both fields, comparing two
              masked values you can't see helps nobody. */}
          <div className="relative">
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              placeholder="Neues Passwort (mind. 8 Zeichen)"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              required
              className={inputClasses}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="confirm-password"
            className="block text-[13px] font-medium text-foreground"
          >
            Passwort bestätigen
          </label>
          <input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            placeholder="Passwort wiederholen"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            className={inputClasses}
          />
        </div>

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
              Passwort speichern
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>
    </AuthExperienceShell>
  );
}
