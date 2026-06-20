"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { z } from "zod";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { Logo } from "@/components/brand/logo";
import { SuccessCelebration } from "@/components/brand/success-celebration";

// three.js only loads on the client and is code-split out of the main bundle.
const CanvasRevealEffect = dynamic(
  () => import("./canvas-reveal-effect").then((m) => m.CanvasRevealEffect),
  { ssr: false }
);

const schema = z.object({
  email: z.string().email("Bitte eine gültige Email eingeben"),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
});

/**
 * Full-bleed login: an animated dot-matrix reveal background behind a dark,
 * glassy email + password form wired to Supabase. Deliberately always dark
 * (the `dark` class pins the token palette) so the look holds in any theme.
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
    <div className="dark relative flex min-h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {celebrateMsg && (
        <SuccessCelebration
          message={celebrateMsg}
          onDone={() => {
            router.push(next);
            router.refresh();
          }}
        />
      )}

      {/* Animated background */}
      <div className="absolute inset-0 z-0">
        <CanvasRevealEffect
          animationSpeed={3}
          containerClassName="bg-background"
          colors={[
            [255, 255, 255],
            [255, 255, 255],
          ]}
          dotSize={6}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--background))_0%,transparent_100%)]" />
        <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-background to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col">
        <header className="px-6 py-6 md:px-10">
          <Link href="/" className="inline-flex">
            <Logo />
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm space-y-7 text-center"
          >
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
          </motion.div>
        </div>
      </div>
    </div>
  );
}
