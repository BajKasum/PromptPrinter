import {
  chatQuotaKey,
  rateLimit,
  rateLimitKey,
  reserveMonthlyQuota,
  reserveServerKeyCall,
} from "@/server/security/rate-limit";
import { llmConfig } from "@/server/llm";
import { getUserOverride } from "@/server/byok";
import { effectiveLimits, type PlanKey } from "@/shared/lib/plans";
import { problem } from "@/server/http/api-problem";
import type { Messages } from "@/shared/i18n/messages/de";
import { fmt } from "@/shared/i18n/format";
import type { SupabaseClient } from "./gate";

// Die Schritte 3 bis 4c von POST /api/chat: Monatskontingent, Stundengrenze, Tagesbudget des
// Server-Keys, Produktionssperre. Hier entstehen die Reservierungen, und JEDER Ausstieg dieses
// Schritts gibt zurueck, was bis dahin reserviert war (releaseReservations). Die Reihenfolge ist Teil
// des Vertrags: Kontingent, dann Stundengrenze, dann Budget (letzte Pruefung vor dem Modell), dann
// Produktionssperre. route.exits.test.ts haelt sie fest.

export type Allowance = {
  /** Der eigene Key des Nutzers (BYOK), oder null: dann laeuft der Zug auf dem Server-Key. */
  override: Awaited<ReturnType<typeof getUserOverride>>;
  /** Gibt jede Reservierung dieses Zugs zurueck. Aufzurufen, sobald der Zug nichts gekostet hat. */
  releaseReservations: () => Promise<void>;
};

export async function reserveAllowance(args: {
  req: Request;
  supabase: SupabaseClient;
  userId: string;
  m: Messages["api"];
}): Promise<Allowance | Response> {
  const { req, supabase, userId, m } = args;
  // 3. Enforce the monthly chat allowance, unless the caller configured their
  //    own BYOK key. Checked before the model call, same principle as
  //    /api/projects's own project-count cap. Runs before the rate limit so its
  //    isAdmin result can exempt the account from that too, admin used to only
  //    bypass the monthly cap, not the hourly one. No longer conditional on
  //    there being a user: there always is one now (step 2), which is precisely
  //    what an anonymous request used to skip.
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();
  const [{ data: profile }, override] = await Promise.all([
    supabase.from("profiles").select("plan, is_admin").eq("id", userId).maybeSingle(),
    getUserOverride(userId),
  ]);

  // One row per turn, completeTurn always inserts exactly one assistant reply
  // alongside the user message, so counting only that role avoids
  // double-counting a turn as two units. Still the number shown in
  // settings/billing either way.
  //
  // LAZY, since the Betriebs-Audit 04.10.2026. This used to run on EVERY turn,
  // alongside the profile read, for every account: a COUNT over the user's
  // assistant messages of the month, whose result was needed in exactly two
  // places and otherwise thrown away. It grows with usage (a heavy account
  // counts thousands of rows per turn) and was paid by accounts that never use
  // it: a BYOK user skips the quota entirely, a Free account is turned away
  // before it, and an account whose Redis reservation succeeds doesn't need it
  // either. Now it runs only (a) when Redis cannot decide, where it IS the
  // enforcement, and (b) when a refusal has to name the figure.
  const countAssistantMessagesThisMonth = async (): Promise<number> => {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "assistant")
      .gte("created_at", monthStart);
    return count ?? 0;
  };
  const isAdmin = profile?.is_admin ?? false;
  const rawPlan = (profile?.plan as string | undefined) ?? "free";
  const plan: PlanKey = rawPlan === "pro" || rawPlan === "team" ? rawPlan : "free";
  const limits = effectiveLimits(plan, isAdmin);

  // Slots reserved for this request (monthly allowance, global daily budget),
  // handed back below if the LLM call itself fails so a failed turn doesn't
  // burn anyone's allowance. Collected together because there are two of them
  // now and both have to be released on every failure path.
  const reservations: (() => Promise<void>)[] = [];
  const releaseReservations = async () => {
    for (const release of reservations) await release();
    reservations.length = 0;
  };

  if (!override) {
    // Free's allowance is exactly zero by design (plans.ts): the plan has no
    // access to the server's own key at all, BYOK is required to chat on Free.
    // This is a distinct state from "limit reached" (which implies the account
    // HAD an allowance and used it up) and gets its own message rather than
    // routing through reserveMonthlyQuota — there is nothing to reserve
    // against, and no reason to spend a Redis round trip finding that out on
    // every single attempt.
    if (limits.chatMessages <= 0) {
      return problem(
        403,
        m.byokRequired,
        { kind: "byokRequired", plan }
      );
    }

    const reservation = await reserveMonthlyQuota(chatQuotaKey(userId, now), limits.chatMessages);
    // null = Redis could not decide (unconfigured or unreachable): the database
    // count is then the enforcement itself, as before.
    let chatCount: number | null = null;
    if (!reservation) chatCount = await countAssistantMessagesThisMonth();
    const overLimit = reservation ? !reservation.allowed : (chatCount ?? 0) >= limits.chatMessages;
    if (overLimit) {
      if (reservation) await reservation.release();
      // The figure goes into the refusal; the one place the count is still read
      // on the Redis path, and a rare one (the user is at their limit).
      chatCount ??= await countAssistantMessagesThisMonth();
      return problem(
        403,
        fmt(m.chatLimit, { plan, limit: limits.chatMessages }),
        { kind: "chatMessages", limit: limits.chatMessages, current: chatCount, plan }
      );
    }
    if (reservation) reservations.push(reservation.release);
  }

  // 4. Hourly rate limit, skipped for admins. Chat is chattier than a one-shot
  //    call, so the ceiling is generous. There is no separate anonymous tier any
  //    more (it was 20/hr) — anonymous callers never get this far.
  if (!isAdmin) {
    const rl = await rateLimit(rateLimitKey(req, userId), { limit: 120, windowMs: 60 * 60 * 1000 });
    if (!rl.allowed) {
      await releaseReservations();
      return problem(429, m.tooManyRequests, {
        retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
      });
    }
  }

  // 4b. Global daily ceiling on the server's own provider key (QA finding S-1,
  //     step 4). Every control above it assumes the attacker is a user and
  //     bounds them individually; this one bounds the *bill*, whoever runs it
  //     up and through whichever hole. It is the backstop for the next leak
  //     nobody has found yet — the anonymous-chat hole would have been capped
  //     at one day's budget instead of unbounded had this existed.
  //
  //     Only for calls that actually spend the server's key: a BYOK user runs
  //     on their own account, costs the operator nothing, and keeps working
  //     even while this is tripped. Last check before the model call, so a
  //     request rejected earlier never consumes budget.
  if (!override) {
    const budget = await reserveServerKeyCall();
    if (budget && !budget.allowed) {
      await budget.release();
      await releaseReservations();
      return problem(
        503,
        m.chatBudget
      );
    }
    if (budget) reservations.push(budget.release);
  }

  // 4c. Refuse in production rather than silently answering with the stub
  //     template (QA finding C-8). Stub mode is a deliberate feature for
  //     development and tests — the whole flow stays testable without any
  //     provider key — but if it were ever reached in production (a missing
  //     ZAI_API_KEY/GEMINI_API_KEY, only warned about at boot, see
  //     assertEnv() in lib/env.ts) it would be a silent total outage of the
  //     one thing this product does: every user gets a plausible-looking
  //     placeholder instead of a real answer, with nothing anywhere signaling
  //     that anything is wrong. A BYOK override always bypasses this, it
  //     never touches the server's own configuration.
  if (!llmConfig() && !override && process.env.NODE_ENV === "production") {
    await releaseReservations();
    return problem(
      503,
      m.chatNotConfigured
    );
  }
  return { override, releaseReservations };
}
