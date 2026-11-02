import { test, expect, adminClient, createAccount, removeAccount, signIn } from "./support/fixtures";
import { E2E_ORIGIN } from "./support/env";

// Das Löschen eines Kontos mit eigenen Keys gegen den lokalen Stack. Der Löschtrigger auf user_api_keys läuft beim Löschen
// aus auth.users unter der Rolle des Auth-Servers, das zeigt nur die echte Datenbank.

async function addKeys(userId: string) {
  const { error } = await adminClient()
    .from("user_api_keys")
    .insert([
      { user_id: userId, provider: "anthropic", encrypted_key: "egal", is_active: true },
      { user_id: userId, provider: "openai", encrypted_key: "egal", is_active: false },
    ]);
  if (error) throw new Error(`E2E: Keys konnten nicht angelegt werden: ${error.message}`);
}

test.describe("Konto mit eigenen Keys", () => {
  test("Konto mit aktivem eigenem Key lässt sich löschen", async ({ browser }) => {
    const account = await createAccount("konto-mit-key");
    await addKeys(account.id);
    const context = await browser.newContext({ baseURL: E2E_ORIGIN });
    try {
      const page = await context.newPage();
      await signIn(page, account);
      const res = await page.request.delete("/api/account", { headers: { origin: E2E_ORIGIN } });
      expect(res.status(), await res.text()).toBe(200);

      const { data } = await adminClient().auth.admin.getUserById(account.id);
      expect(data.user).toBeNull();
      const { data: rows, error } = await adminClient().from("user_api_keys").select("id").eq("user_id", account.id);
      expect(error).toBeNull();
      expect(rows).toEqual([]);
    } finally {
      await context.close();
      await adminClient().from("user_api_keys").delete().eq("user_id", account.id);
      await removeAccount(account.id);
    }
  });

  test("der nächste Key rückt nach, wenn der aktive gelöscht wird", async () => {
    const account = await createAccount("key-rueckt-nach");
    await addKeys(account.id);
    try {
      const admin = adminClient();
      const deleted = await admin.from("user_api_keys").delete().eq("user_id", account.id).eq("provider", "anthropic");
      expect(deleted.error).toBeNull();
      const { data: rows } = await admin.from("user_api_keys").select("provider, is_active").eq("user_id", account.id);
      expect(rows).toEqual([{ provider: "openai", is_active: true }]);
    } finally {
      await adminClient().from("user_api_keys").delete().eq("user_id", account.id);
      await removeAccount(account.id);
    }
  });
});
