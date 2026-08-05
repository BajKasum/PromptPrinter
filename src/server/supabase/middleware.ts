import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { secureCookieOptions } from "@/server/supabase/cookie-options";

type CookieSet = { name: string; value: string; options: CookieOptions };

// Everything a signed-out visitor may reach. Anything not listed needs a
// session (Security-Audit finding M-7).
//
// This used to be the other way round — an allowlist of PROTECTED prefixes —
// which is a hand-maintained duplicate of the route tree, and it had already
// drifted: /prompts was added without being listed, so it was guarded only by
// the (app) layout's own check, one layer later than intended. Inverting the
// default means the failure mode of forgetting an entry flips from "new page is
// unguarded" to "new public page redirects to login", which is visible the
// first time anyone opens it instead of silent.
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/reset-password",
  "/auth", // the OAuth/email callback completes the session, so it can't need one
  // No "/features": next.config.ts redirects it to /#funktionen, and
  // next.config redirects resolve before middleware runs, so the path never
  // reaches this check.
  "/pricing",
  "/docs",
  "/agb",
  "/datenschutz",
  "/impressum",
  "/kontakt",
  "/rueckerstattung",
  "/ueber",
] as const;

// Metadata routes Next serves from the app directory. Exact matches only, so
// they can't shadow a real page.
const PUBLIC_EXACT = ["/", "/robots.txt", "/sitemap.xml", "/opengraph-image"] as const;

function requiresSession(pathname: string): boolean {
  // API routes answer for themselves. Every one of them already returns a 401
  // JSON problem response when there is no session (/api/chat, /api/projects,
  // /api/settings/api-key, /api/account), and /api/health is deliberately
  // public so an uptime checker — which has no session — can reach it.
  // Redirecting these to /login would turn a machine-readable 401 into a 302
  // to an HTML page, which every caller here would mis-parse.
  if (pathname.startsWith("/api/")) return false;

  if ((PUBLIC_EXACT as readonly string[]).includes(pathname)) return false;
  return !PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Braucht dieser Pfad ueberhaupt einen Blick auf die Session?
 *
 * Bis Planpunkt B-2 lief `supabase.auth.getUser()` auf JEDEM Request — auch
 * beim Abruf von `/agb`, `/docs` oder der Landing Page, wo das Ergebnis
 * niemanden interessiert. Fuer anonyme Besucher war das folgenlos, fuer
 * eingeloggte eine zusaetzliche Netzwerkrunde vor jedem Seitenaufruf.
 *
 * Zwei oeffentliche Pfade brauchen den Blick trotzdem, und das ist der Grund,
 * warum hier nicht einfach `!requiresSession(pathname)` steht:
 * `/login` und `/signup` leiten eingeloggte Nutzer nach `/chats/new` weiter,
 * und dafuer muss man wissen, ob jemand eingeloggt ist. `/reset-password` und
 * `/auth/*` bleiben ebenfalls drin: dort werden Sessions gerade hergestellt
 * oder geaendert, und das Aktualisieren der Cookies laeuft ueber genau diesen
 * Aufruf.
 *
 * Die uebrigen oeffentlichen Seiten verlieren dadurch nur die Cookie-
 * Auffrischung waehrend des Lesens. Das ist unkritisch: der naechste Schritt
 * in die App frischt auf, und bis dahin passiert nichts, was eine gueltige
 * Session braeuchte.
 */
function needsSessionLookup(pathname: string): boolean {
  if (requiresSession(pathname)) return true;
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/")
  );
}

export async function updateSession(request: NextRequest, requestHeaders: Headers) {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Oeffentliche Seiten kommen ohne Supabase-Runde aus (B-2). Vor dem Anlegen
  // des Clients, damit wirklich nichts passiert — nicht erst vor dem Aufruf.
  if (!needsSessionLookup(request.nextUrl.pathname)) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet: CookieSet[]) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, secureCookieOptions(options))
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && requiresSession(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/chats/new";
    return NextResponse.redirect(redirect);
  }

  return response;
}
