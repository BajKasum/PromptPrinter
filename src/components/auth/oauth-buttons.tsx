"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { siteUrl } from "@/lib/site-url";
import { translateAuthError } from "@/lib/auth-errors";

type Provider = "google" | "github";

// Official brand marks (allowed exception to the no-raw-hex rule, same as
// tool-logos.tsx): providers require their logos in their real colors.
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v2.98h3.89c2.26-2.09 3.53-5.17 3.53-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.89-2.98c-1.08.72-2.45 1.16-4.04 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.31A7.16 7.16 0 0 1 4.89 12c0-.8.14-1.58.38-2.31V6.6H1.29a11.99 11.99 0 0 0 0 10.8l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.73c1.77 0 3.35.61 4.6 1.8l3.45-3.45A11.51 11.51 0 0 0 12 0 11.99 11.99 0 0 0 1.29 6.6l3.98 3.09C6.22 6.84 8.87 4.73 12 4.73z"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-foreground" aria-hidden>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

const BUTTON_ROW =
  "flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface-raised text-[14px] font-medium text-foreground transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/**
 * "Weiter mit Google / GitHub", Supabase OAuth (PKCE). The provider redirect
 * lands on the existing /auth/callback, which exchanges the code and forwards
 * to `next`. Requires the providers to be enabled in the Supabase dashboard
 * (Authentication → Providers), until then Supabase returns a clear
 * "provider is not enabled" error, surfaced right here.
 */
export function OAuthButtons({ next }: { next: string }) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(provider: Provider) {
    if (pending) return;
    setPending(provider);
    setError(null);
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: siteUrl(`/auth/callback?next=${encodeURIComponent(next)}`) },
      });
      if (oauthError) {
        setError(translateAuthError(oauthError.message));
        setPending(null);
      }
      // On success the browser navigates to the provider, keep the spinner.
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : "Unbekannter Fehler");
      setPending(null);
    }
  }

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={() => void start("google")}
        disabled={pending !== null}
        className={BUTTON_ROW}
      >
        {pending === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />}
        Weiter mit Google
      </button>
      <button
        type="button"
        onClick={() => void start("github")}
        disabled={pending !== null}
        className={BUTTON_ROW}
      >
        {pending === "github" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitHubMark />}
        Weiter mit GitHub
      </button>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive"
        >
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1 text-[12px] text-foreground/40">
        <span className="h-px flex-1 bg-border" />
        oder mit Email
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
