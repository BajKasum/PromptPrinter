import { createClient } from "@supabase/supabase-js";
import { test, expect, adminClient, createAccount, removeAccount, signIn } from "./support/fixtures";
import { E2E_ORIGIN, localSupabase } from "./support/env";

// Das Sicherheitsprotokoll gegen den lokalen Stack: echte Rechte, echte Prüfregeln. Die Routen schreiben hinein, der
// Browser kommt nicht heran, der Server kann nichts umschreiben, und die Frist greift wirklich.

async function eventsOf(userId: string) {
  const { data, error } = await adminClient()
    .from("security_events")
    .select("event, details")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`E2E: ${error.message}`);
  return data ?? [];
}

test.describe("Sicherheitsprotokoll", () => {
  test("Zustimmung und Widerruf stehen danach in der Tabelle, ohne die Adresse", async ({ signedIn: { page, account } }) => {
    const granted = await page.request.post("/api/consent/zai", { headers: { origin: E2E_ORIGIN } });
    expect(granted.status(), await granted.text()).toBe(200);
    const withdrawn = await page.request.delete("/api/consent/zai", { headers: { origin: E2E_ORIGIN } });
    expect(withdrawn.status(), await withdrawn.text()).toBe(200);

    const events = await eventsOf(account.id);
    expect(events.map((e) => e.event)).toEqual(["consent.zai_granted", "consent.zai_withdrawn"]);
    expect(JSON.stringify(events)).not.toContain(account.email);
  });

  test("das Löschen eines Kontos überlebt das Konto", async ({ browser }) => {
    const account = await createAccount("protokoll-weg");
    const context = await browser.newContext({ baseURL: E2E_ORIGIN });
    try {
      const page = await context.newPage();
      await signIn(page, account);
      const res = await page.request.delete("/api/account", { headers: { origin: E2E_ORIGIN } });
      expect(res.status(), await res.text()).toBe(200);

      const { data } = await adminClient().auth.admin.getUserById(account.id);
      expect(data.user).toBeNull();
      expect((await eventsOf(account.id)).map((e) => e.event)).toEqual(["account.deleted"]);
    } finally {
      await context.close();
      await removeAccount(account.id);
    }
  });

  test("der Browser liest und schreibt nichts, auch nicht das eigene Konto", async ({ account }) => {
    const { url, anonKey } = localSupabase();
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await client.auth.signInWithPassword({ email: account.email, password: account.password });
    expect(login.error).toBeNull();

    const read = await client.from("security_events").select("id");
    expect(read.error?.code).toBe("42501");
    const write = await client.from("security_events").insert({ event: "erfunden", user_id: account.id });
    expect(write.error?.code).toBe("42501");
  });

  test("auch der Server kann nichts umschreiben, nur anhängen", async ({ account }) => {
    const admin = adminClient();
    const inserted = await admin
      .from("security_events")
      .insert({ event: "api_key.saved", user_id: account.id })
      .select("id")
      .single();
    expect(inserted.error).toBeNull();

    const update = await admin.from("security_events").update({ event: "erfunden" }).eq("id", inserted.data!.id);
    expect(update.error?.code).toBe("42501");
    const remove = await admin.from("security_events").delete().eq("id", inserted.data!.id);
    expect(remove.error?.code).toBe("42501");
  });

  test("die Aufräumfunktion löscht nur, was älter als 180 Tage ist", async ({ account }) => {
    const admin = adminClient();
    const days = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
    const inserted = await admin.from("security_events").insert([
      { event: "e2e.alt", user_id: account.id, created_at: days(181) },
      { event: "e2e.grenze", user_id: account.id, created_at: days(179) },
      { event: "e2e.neu", user_id: account.id },
    ]);
    expect(inserted.error).toBeNull();

    const pruned = await admin.rpc("prune_security_events");
    expect(pruned.error).toBeNull();
    expect((await eventsOf(account.id)).map((e) => e.event).sort()).toEqual(["e2e.grenze", "e2e.neu"]);
  });

  test("der Browser darf die Aufräumfunktion nicht aufrufen", async ({ account }) => {
    const { url, anonKey } = localSupabase();
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const anonymous = await client.rpc("prune_security_events");
    expect(anonymous.error).not.toBeNull();

    await client.auth.signInWithPassword({ email: account.email, password: account.password });
    const signedIn = await client.rpc("prune_security_events");
    expect(signedIn.error).not.toBeNull();
  });
});
