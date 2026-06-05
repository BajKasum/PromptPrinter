"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

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

export function UpdatePassword() {
  const router = useRouter();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = next.length >= 8 && confirm.length > 0 && !loading;

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

      // The recovery session is now a normal session — land them in the app.
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="new-password">Neues Passwort</Label>
        <PasswordInput
          id="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="Mindestens 8 Zeichen"
          autoComplete="new-password"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Bestätigen</Label>
        <PasswordInput
          id="confirm-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Neues Passwort wiederholen"
          autoComplete="new-password"
          required
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[13px] text-red-300">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Wird gespeichert…
          </>
        ) : (
          <>
            <Check className="h-4 w-4" />
            Passwort speichern
          </>
        )}
      </Button>
    </form>
  );
}
