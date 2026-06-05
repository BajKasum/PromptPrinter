"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Loader2, MailCheck } from "lucide-react";

const schema = z.object({
  email: z.string().email("Bitte eine gültige Email eingeben"),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
});

type Mode = "signin" | "signup";

function translateError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email oder Passwort falsch";
  if (m.includes("email not confirmed")) return "Email wurde noch nicht bestätigt — bitte Posteingang prüfen";
  if (m.includes("user already registered")) return "Diese Email ist bereits registriert — bitte einloggen";
  if (m.includes("email address") && m.includes("invalid")) return "Diese Email-Adresse wird nicht akzeptiert";
  if (m.includes("password should be")) return "Passwort zu schwach (mindestens 8 Zeichen)";
  if (m.includes("rate limit")) return "Zu viele Versuche — bitte kurz warten";
  return message;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [signupSent, setSignupSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(translateError(error.message));
          return;
        }
        router.push(next);
        router.refresh();
        return;
      }

      // mode === "signup"
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) {
        setError(translateError(error.message));
        return;
      }

      // Wenn Email-Confirmation aktiv ist, gibt Supabase user aber KEINE session zurück.
      // In diesem Fall den User informieren statt blind zu Dashboard zu redirecten.
      if (!data.session) {
        setSignupSent(true);
        return;
      }

      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? translateError(err.message) : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) setError(translateError(error.message));
      else setInfo("Bestätigungs-Email wurde erneut gesendet.");
    } catch (err) {
      setError(err instanceof Error ? translateError(err.message) : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  if (signupSent) {
    return (
      <div className="w-full max-w-[400px] text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/[0.12] border border-emerald-500/30">
          <MailCheck className="h-6 w-6 text-emerald-300" strokeWidth={1.8} />
        </div>
        <h2 className="text-[18px] font-semibold text-white mb-2">Bestätigungs-Email gesendet</h2>
        <p className="text-[13.5px] text-white/60 mb-6">
          Wir haben einen Bestätigungs-Link an <span className="text-white">{email}</span> geschickt.
          Klick darauf, um dein Konto zu aktivieren und dich einzuloggen.
        </p>
        {info && (
          <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2 text-[13px] text-emerald-300">
            {info}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[13px] text-red-300">
            {error}
          </div>
        )}
        <Button
          onClick={handleResendConfirmation}
          variant="ghost"
          className="w-full"
          disabled={loading}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Email erneut senden
        </Button>
        <div className="mt-4 text-[13px] text-white/55">
          Schon bestätigt?{" "}
          <Link href="/login" className="text-white hover:underline">
            Einloggen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="du@example.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Passwort</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mindestens 8 Zeichen"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
          />
          {mode === "signin" && (
            <div className="text-right">
              <Link
                href="/reset-password"
                className="text-[12.5px] text-white/50 hover:text-white/80 transition-colors"
              >
                Passwort vergessen?
              </Link>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[13px] text-red-300">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "signin" ? "Einloggen" : "Konto erstellen"}
        </Button>
      </form>

      <div className="mt-6 text-center text-[13px] text-white/55">
        {mode === "signin" ? (
          <>
            Noch kein Konto?{" "}
            <Link href="/signup" className="text-white hover:underline">
              Registrieren
            </Link>
          </>
        ) : (
          <>
            Schon ein Konto?{" "}
            <Link href="/login" className="text-white hover:underline">
              Einloggen
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
