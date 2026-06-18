import { NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  // Only ever forward to an in-app path — never an attacker-supplied absolute URL.
  const rawNext = url.searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") ? rawNext : "/dashboard";

  const supabase = await createClient();

  // Preferred path for email links (recovery, signup confirm, magic link): the
  // template hands us token_hash + type, which we verify server-side. No PKCE
  // code-verifier cookie is needed, so it survives a link opened in a different
  // browser/tab — and token_hash is a normal query param, so (unlike the implicit
  // #access_token hash) the server can actually read it.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(siteUrl(next));
  } else if (code) {
    // PKCE path — OAuth providers, and any legacy code-based email links.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(siteUrl(next));
  }

  return NextResponse.redirect(siteUrl("/login?error=auth_callback_failed"));
}
