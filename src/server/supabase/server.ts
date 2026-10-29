import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createTokenClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { bearerToken } from "@/server/supabase/bearer";
import { secureCookieOptions } from "@/server/supabase/cookie-options";

type CookieSet = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: CookieSet[]) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, secureCookieOptions(options))
            );
          } catch {
            // Called from a Server Component, middleware refresh handles it.
          }
        },
      },
    }
  );
}

/**
 * Der Client für eine Anfrage, die auch von der Kommandozeile kommen darf (Anmeldung per Geräte-Code,
 * `api/cli/*`). Trägt sie `Authorization: Bearer`, gewinnt der Kopf: der Client bekommt genau dieses
 * Token, liest keine Cookies und setzt keine (eine Kommandozeile hat keine, und ein Cookie des Browsers
 * darf ein ungültiges Token nicht retten). Sonst ist es `createClient()`. Die Prüfung bleibt
 * `auth.getUser()` beim Auth-Server: nur so ist ein gelöschtes Konto sofort draußen, das JWT allein
 * wäre bis zu seinem Ablauf gültig. Welche Routen diesen Weg nutzen dürfen, hält
 * tests/guards/bearer-routes.test.ts fest.
 */
export async function createClientForRequest(req: Request) {
  const token = bearerToken(req);
  if (token === null) return createClient();
  return createTokenClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
  );
}
