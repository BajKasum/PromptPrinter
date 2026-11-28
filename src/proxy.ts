import { type NextRequest } from "next/server";
import { updateSession } from "@/server/supabase/middleware";
import { buildCsp, buildStaticCsp, thirdPartiesFor } from "@/server/security/csp";
import { problem } from "@/server/http/api-problem";
import { isForbiddenCrossOriginApiCall } from "@/server/security/request-origin";
import { isAppPath } from "@/shared/lib/app-routes";

// Nexts Proxy-Konvention (bis Version 15 "Middleware"): läuft auf dem Node.js-Server vor jeder Route, auf die der
// Matcher unten passt. Eine Laufzeit lässt sich hier nicht wählen, `runtime` im config-Objekt ist ein Buildfehler.
export async function proxy(request: NextRequest) {
  // Vor allem anderen: eine untergeschobene Anfrage bekommt weder eine Sitzungsrunde noch die Route.
  if (isForbiddenCrossOriginApiCall(request, request.nextUrl.pathname)) {
    return problem(403, "Diese Anfrage kommt nicht von dieser Seite.", { kind: "origin" });
  }

  // Base64, weil eine CSP-Nonce nur dieses Alphabet kennt: die Bindestriche einer UUID sind dort ungültig.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Auf die Anfrage kommt nur x-nonce (layout.tsx liest es über headers() und gibt es an next-themes weiter). Die
  // Policy selbst gehört allein auf die Antwort: auf der Anfrage läse sie niemand, und ein vorgeschalteter Proxy, der
  // Anfrageköpfe in die Antwort spiegelt, ergäbe eine zweite, mehrdeutige Policy.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = await updateSession(request, requestHeaders);

  // Zwei Policies, nicht eine (Herleitung in server/security/csp.ts): nur `(app)/*` liest den Nonce über headers().
  // Jede andere Seite ist statisch, ihre Hydrationsskripte tragen keinen Nonce, unter der strikten Policy hydrierte
  // sie nicht. Das gilt auch für die 404 einer toten Adresse, deshalb entscheidet `isAppPath()`
  // (shared/lib/app-routes.ts) und nicht, ob der Pfad eine Sitzung verlangt. Drittanbieter (Captcha) stehen nur in der
  // Policy der Routen, die sie laden.
  const pathname = request.nextUrl.pathname;
  const parties = thirdPartiesFor(pathname);
  const csp = isAppPath(pathname) ? buildCsp(nonce, parties) : buildStaticCsp(parties);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
