import { type NextRequest } from "next/server";
import { updateSession } from "@/server/supabase/middleware";
import { buildCsp } from "@/server/security/csp";

export async function middleware(request: NextRequest) {
  // Base64-encode the UUID: CSP's nonce-source grammar is base64 alphabet
  // only, a raw UUID's hyphens aren't valid there.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Only x-nonce goes on the request (layout.tsx reads it via headers() to
  // pass the same nonce to next-themes). CSP itself is only ever meaningful
  // as a RESPONSE header (set below); writing it onto the request too (QA
  // finding S-6) did nothing — nothing reads it there — and risked a second,
  // ambiguous CSP header if some upstream proxy ever mirrors request headers
  // into the response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = await updateSession(request, requestHeaders);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
