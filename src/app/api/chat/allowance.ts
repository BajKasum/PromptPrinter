import { reserveModelCall, type ModelCallAllowance } from "@/server/model-call";
import { rateLimit, rateLimitKey } from "@/server/security/rate-limit";
import type { Messages } from "@/shared/i18n/messages/de";
import type { SupabaseClient } from "./gate";

// Die Schritte 3 bis 4c von POST /api/chat: Monatskontingent, Stundengrenze, Tagesbudget des
// Server-Keys, Produktionssperre. Die Kette selbst steht in server/model-call.ts (die
// Gedächtnis-Analyse ruft dieselbe); hier stehen nur die Optionen des Chats. Hier entstehen die
// Reservierungen, und JEDER Ausstieg dieses Schritts gibt zurück, was bis dahin reserviert war
// (releaseReservations). Die Reihenfolge ist Teil des Vertrags: Kontingent, dann Stundengrenze,
// dann Budget (letzte Prüfung vor dem Modell), dann Produktionssperre. route.exits.test.ts hält sie fest.

/** Der eigene Key des Nutzers (BYOK) oder null, dazu die Rückgabe aller Reservierungen dieses Zugs. */
export type Allowance = Pick<ModelCallAllowance, "override" | "releaseReservations">;

export async function reserveAllowance(args: {
  req: Request;
  supabase: SupabaseClient;
  userId: string;
  /** app_metadata des Kontos (Einwilligung in die Übermittlung an Z.ai, server/consent.ts). */
  appMetadata: unknown;
  m: Messages["api"];
}): Promise<Allowance | Response> {
  const { req, userId, m } = args;
  // Chat ist gesprächiger als ein Einzelaufruf, die Grenze entsprechend großzügig.
  return reserveModelCall({
    supabase: args.supabase,
    userId,
    appMetadata: args.appMetadata,
    m,
    checkHourlyLimit: () => rateLimit(rateLimitKey(req, "chat", userId), { limit: 120, windowMs: 60 * 60 * 1000 }),
    texts: {
      monthlyLimit: m.chatLimit,
      tooMany: m.tooManyRequests,
      budget: m.chatBudget,
      notConfigured: m.chatNotConfigured,
    },
    stubOutsideProduction: true,
  });
}
