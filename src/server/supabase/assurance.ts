import "server-only";

// Der zweite Faktor als Schranke. Hat ein Konto einen bestätigten Faktor, muss die Sitzung ihn auch nachgewiesen haben
// (AAL2 im JWT). Die drei Aktionen, die das auf dem Server verlangen, stehen in docs/SETUP.md, "Zweiter Faktor".

type WithFactors = { factors?: { status: string }[] | null };

/** Die Sitzung, deren JWT geprüft wird. Der Kreis der Clients bleibt so klein wie die eine Methode, die gebraucht wird. */
type ClaimsClient = { auth: { getClaims(): Promise<{ data: { claims: { aal?: unknown } } | null }> } };

export function hasVerifiedFactor(user: WithFactors): boolean {
  return (user.factors ?? []).some((factor) => factor.status === "verified");
}

/**
 * Fehlt dieser Sitzung der Nachweis des zweiten Faktors? Für ein Konto ohne Faktor immer `false`, und dann ohne jede Anfrage:
 * das ist fast jedes Konto. Ohne lesbares JWT gilt der Nachweis als nicht erbracht.
 */
export async function lacksSecondFactor(supabase: ClaimsClient, user: WithFactors): Promise<boolean> {
  if (!hasVerifiedFactor(user)) return false;
  const { data } = await supabase.auth.getClaims();
  return data?.claims.aal !== "aal2";
}
