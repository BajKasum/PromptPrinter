import { type NextRequest } from "next/server";
import { updateSession } from "@/server/supabase/middleware";
import { buildCsp, buildStaticCsp } from "@/server/security/csp";
import { isAppPath } from "@/shared/lib/app-routes";

export async function middleware(request: NextRequest) {
  // Base64-encode the UUID: CSP's nonce-source grammar is base64 alphabet
  // only, a raw UUID's hyphens aren't valid there.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Only x-nonce goes on the request (layout.tsx reads it via headers() to
  // pass the same nonce to next-themes). CSP itself is only ever meaningful
  // as a RESPONSE header (set below); writing it onto the request too (QA
  // finding S-6) did nothing — nothing reads it there — and risked a second,
  // ambiguous CSP header if some upstream proxy ever mirrors request headers
  // into the response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = await updateSession(request, requestHeaders);

  // Zwei Policies, nicht eine (gefunden 05.08.2026, siehe csp.ts für die volle
  // Herleitung). Nur `(app)/*` liest den Nonce noch per `headers()` — jede
  // andere Route ist seit Planpunkt B-2 statisch und threadet ihn nirgends
  // mehr durch, bekam bis eben aber trotzdem die strikte Nonce-only-Policy:
  // Next' eigene Hydration-Scripts hatten keinen passenden Nonce, die CSP
  // blockierte sie, React hydrierte nie. `isAppPath()` ist die eine Quelle für
  // "ist das eine (app)-Route" (shared/lib/app-routes.ts). Bis 2026-10-01
  // stand hier `requiresSession()`: das traf auch jede tote Adresse, deren
  // 404-Seite statisch ist und unter der Nonce-Policy genauso wenig hydrierte.
  const csp = isAppPath(request.nextUrl.pathname) ? buildCsp(nonce) : buildStaticCsp();
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
