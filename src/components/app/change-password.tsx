"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

function translatePasswordError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("different from the old") || m.includes("should be different"))
    return "Das neue Passwort muss sich vom aktuellen unterscheiden.";
  if (m.includes("password should be")) return "Passwort zu schwach (mindestens 8 Zeichen).";
  if (m.includes("rate limit")) return "Zu viele Versuche — bitte kurz warten.";
  if (m.includes("invalid login credentials")) return "Aktuelles Passwort ist falsch.";
  return message;
}

export function ChangePassword({ email }: { email: string }) {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = current.length > 0 && next.length >= 8 && confirm.length > 0 && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (next.length < 8) {
      setError("Das neue Passwort braucht mindestens 8 Zeichen.");
      return;
    }
    if (next !== confirm) {
      setError("Die beiden neuen Passwörter stimmen nicht überein.");
      return;
    }
    if (next === current) {
      setError("Das neue Passwort muss sich vom aktuellen unterscheiden.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      // Verify the current password first. A logged-in Supabase session can change
      // the password without re-auth, so this re-check stops a hijacked or unattended
      // session from locking the real owner out — and refreshes recency for the update.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (reauthError) {
        setError("Aktuelles Passwort ist falsch.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        setError(translatePasswordError(updateError.message));
        return;
      }

      setCurrent("");
      setNext("");
      setConfirm("");
      toast({ title: "Passwort geändert", variant: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-[12.5px] text-foreground/45">
        Zur Sicherheit bestätigst du zuerst dein aktuelles Passwort, bevor du ein neues
        setzt.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="current-password">Aktuelles Passwort</Label>
          <PasswordInput
            id="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">Neues Passwort</Label>
          <PasswordInput
            id="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Mindestens 8 Zeichen"
            autoComplete="new-password"
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
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[13px] text-red-300">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={!canSubmit}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Wird geändert…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Passwort ändern
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
