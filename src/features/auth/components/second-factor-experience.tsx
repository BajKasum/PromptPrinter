"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { AuthExperienceShell } from "@/features/auth/components/auth-experience-shell";
import { createClient } from "@/shared/supabase/client";
import { Input } from "@/shared/ui/input";
import { safeNextPath } from "@/shared/lib/site-url";

/**
 * Der zweite Schritt der Anmeldung (/login/zweiter-faktor): der Code aus der Authenticator-App, oder ohne Gerät ein
 * Wiederherstellungscode. Die Middleware schickt jede App-Seite hierher, solange die Sitzung den Faktor nicht nachgewiesen hat.
 * Braucht die Sitzung den Schritt gar nicht (kein Faktor, schon bestätigt), geht es sofort weiter.
 */
export function SecondFactorExperience() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNextPath(search.get("next"));

  const [mode, setMode] = useState<"code" | "recovery">("code");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const res = await fetch("/api/auth/mfa").catch(() => null);
      if (cancelled || !res) return;
      if (res.status === 401) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- gewollt: ganzer Neuaufbau, es gibt keine Sitzung
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        return;
      }
      const body = (await res.json().catch(() => null)) as { needsVerification?: boolean } | null;
      if (!cancelled && res.ok && body && !body.needsVerification) router.replace(next);
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  async function send(payload: Record<string, string>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as { detail?: string } | null;
      setError(body?.detail ?? "Das hat nicht geklappt. Bitte versuch es noch einmal.");
    } catch {
      setError("Keine Verbindung zum Server. Bitte prüf deine Verbindung und versuch es erneut.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "code") void send({ action: "verify", code });
    else void send({ action: "recover", recoveryCode });
  }

  function switchMode(target: "code" | "recovery") {
    setMode(target);
    setError(null);
  }

  async function signOut() {
    try {
      await createClient().auth.signOut({ scope: "local" });
    } catch {
      // Scheitert das Abmelden, zeigt die Anmeldeseite den Weg hierher wieder an.
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- gewollt: ganzer Neuaufbau ohne Sitzung
    window.location.href = "/login";
  }

  const canSubmit = mode === "code" ? /^\d{6}$/.test(code) : recoveryCode.trim().length > 0;

  return (
    <AuthExperienceShell panelTitle="Fast geschafft." panelSub="Nur noch der Code aus deiner App, dann bist du wieder drin.">
      <div className="space-y-1.5">
        <h1 className="text-[2rem] font-bold leading-[1.1] tracking-tight text-foreground">Noch ein Schritt</h1>
        <p className="text-[15px] font-light text-secondary">
          {mode === "code"
            ? "Gib den sechsstelligen Code aus deiner Authenticator-App ein."
            : "Ein Wiederherstellungscode schaltet den zweiten Faktor aus. Danach richtest du ihn in den Einstellungen neu ein."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "code" ? (
          <div className="space-y-1.5">
            <label htmlFor="mfa-code" className="block text-[13px] font-medium text-foreground">
              Code aus der App
            </label>
            <Input
              id="mfa-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className="font-mono tracking-[0.2em]"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor="mfa-recovery" className="block text-[13px] font-medium text-foreground">
              Wiederherstellungscode
            </label>
            <Input
              id="mfa-recovery"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
              className="font-mono"
            />
          </div>
        )}

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
          disabled={loading || !canSubmit}
          className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {mode === "code" ? "Bestätigen" : "Code einlösen"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <div className="space-y-2 text-center text-[13px] text-secondary">
        {mode === "code" ? (
          <button
            type="button"
            onClick={() => switchMode("recovery")}
            className="touch-hit-y relative text-accent-text underline underline-offset-2"
          >
            Gerät verloren? Wiederherstellungscode eingeben
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => switchMode("code")}
              className="touch-hit-y relative text-accent-text underline underline-offset-2"
            >
              Zurück zum Code aus der App
            </button>
            <p>
              Auch die Codes sind weg? Schreib mir über das{" "}
              <Link href="/kontakt" className="text-accent-text underline underline-offset-2">
                Kontaktformular
              </Link>
              , von der Adresse deines Kontos aus.
            </p>
          </>
        )}
        <p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="touch-hit-y relative text-tertiary transition-colors hover:text-foreground/80"
          >
            Abmelden
          </button>
        </p>
      </div>
    </AuthExperienceShell>
  );
}
