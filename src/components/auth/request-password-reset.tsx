"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Loader2, MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const emailSchema = z.string().email("Bitte eine gültige Email eingeben");

export function RequestPasswordReset() {
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
      // The recovery link returns through the shared callback, which exchanges
      // the code for a session and forwards to the password-update page.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password/update`,
      });

      // Surface only rate-limiting. Everything else resolves to the same neutral
      // confirmation so the form never reveals whether an email is registered.
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
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/[0.12]">
          <MailCheck className="h-6 w-6 text-emerald-300" strokeWidth={1.8} />
        </div>
        <h2 className="mb-2 text-[18px] font-semibold text-white">Email unterwegs</h2>
        <p className="mb-6 text-[13.5px] text-white/60">
          Falls ein Konto mit <span className="text-white">{email}</span> existiert, haben wir einen
          Link zum Zurücksetzen des Passworts gesendet. Prüfe auch deinen Spam-Ordner.
        </p>
        <div className="text-[13px] text-white/55">
          <Link href="/login" className="text-white hover:underline">
            Zurück zum Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="du@example.com"
            autoComplete="email"
            required
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[13px] text-red-300">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Link senden
        </Button>
      </form>

      <div className="mt-6 text-center text-[13px] text-white/55">
        Doch erinnert?{" "}
        <Link href="/login" className="text-white hover:underline">
          Einloggen
        </Link>
      </div>
    </div>
  );
}
