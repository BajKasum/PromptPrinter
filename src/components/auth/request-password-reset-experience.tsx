"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { siteUrl } from "@/lib/site-url";
import { AuthExperienceShell } from "@/components/auth/auth-experience-shell";

const emailSchema = z.string().email("Bitte eine gültige Email eingeben");

/**
 * Full-bleed "request password reset" screen — same animated backdrop as login.
 * Sends the recovery link through the shared /auth/callback, which forwards to
 * the password-update page.
 */
export function RequestPasswordResetExperience() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ungültige Email");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: siteUrl("/auth/callback?next=/reset-password/update"),
      });
      // Only surface rate-limiting; otherwise stay neutral so we never reveal
      // whether an email is registered.
      if (resetError && resetError.message.toLowerCase().includes("rate limit")) {
        setError("Zu viele Versuche — bitte kurz warten.");
        return;
      }
      setSent(true);
    } catch {
      setError("Unbekannter Fehler. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
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
            Falls ein Konto mit <span className="text-foreground">{email}</span> existiert, haben wir
            einen Link zum Zurücksetzen gesendet. Prüfe auch deinen Spam-Ordner.
          </p>
        </div>
        <p className="text-[13px] text-foreground/55">
          <Link href="/login" className="text-foreground hover:underline">
            Zurück zum Login
          </Link>
        </p>
      </AuthExperienceShell>
    );
  }

  return (
    <AuthExperienceShell>
      <div className="space-y-1.5">
        <h1 className="text-[2.25rem] font-bold leading-[1.1] tracking-tight text-foreground">
          Passwort vergessen?
        </h1>
        <p className="text-[15px] font-light text-foreground/60">
          Gib deine Email ein — wir senden dir einen Link zum Zurücksetzen.
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
              Link senden
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p className="text-[13px] text-foreground/55">
        Doch erinnert?{" "}
        <Link href="/login" className="text-foreground hover:underline">
          Einloggen
        </Link>
      </p>
    </AuthExperienceShell>
  );
}
