import { test, expect, adminClient, createAccount, removeAccount } from "./support/fixtures";
import { E2E_ORIGIN, localSupabase } from "./support/env";

// Teilen per Link gegen den lokalen Stack (Migration 0057): echte Sitzung, echte RLS, echter zusammengesetzter
// Fremdschlüssel. Ein zweites Konto darf den Prompt nicht teilen, die öffentliche Seite zeigt nur Titel und Text,
// und nach dem Widerrufen führt der Link ins Leere.

test.describe("Gespeicherten Prompt per Link teilen", () => {
  test("teilt, zeigt öffentlich ohne Angaben zur Person und widerruft", async ({ signedIn: { page, account }, browser }) => {
    const other = await createAccount("prompt-share-fremd");
    try {
      const admin = adminClient();
      const { data, error } = await admin
        .from("saved_prompts")
        .insert({ user_id: account.id, project_id: null, outputs: { title: "Sommerfest", prompt: "Schreibe eine Einladung zum Sommerfest" } })
        .select("id")
        .single();
      expect(error).toBeNull();
      const promptId = data!.id as string;
      const headers = { origin: E2E_ORIGIN };

      // Fremdes Konto: der Prompt existiert für es nicht.
      const foreign = await admin.from("prompt_shares").insert({ token: "a".repeat(32), prompt_id: promptId, user_id: other.id });
      expect(foreign.error?.code).toBe("23503");

      const shared = await page.request.post(`/api/prompts/${promptId}/share`, { headers });
      expect(shared.status(), await shared.text()).toBe(200);
      const { token } = (await shared.json()) as { token: string };
      expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
      // Ein zweites Teilen gibt dasselbe Token.
      expect((await (await page.request.post(`/api/prompts/${promptId}/share`, { headers })).json()).token).toBe(token);

      // Ohne Anmeldung, in einem frischen Kontext.
      const visitor = await (await browser.newContext()).newPage();
      const res = await visitor.goto(`/geteilt/${token}`);
      expect(res?.status()).toBe(200);
      await expect(visitor.getByRole("heading", { level: 1, name: "Sommerfest" })).toBeVisible();
      await expect(visitor.getByText("Schreibe eine Einladung zum Sommerfest")).toBeVisible();
      const html = await visitor.content();
      expect(html).not.toContain(account.email);
      expect(html).toMatch(/<meta name="robots" content="noindex, nofollow/);

      // anon liest die Tabelle nicht.
      const local = localSupabase();
      const anon = await visitor.request.get(`${local.url}/rest/v1/prompt_shares?select=*`, {
        headers: { apikey: local.anonKey },
      });
      expect(await anon.json()).not.toEqual(expect.arrayContaining([expect.objectContaining({ token })]));

      const revoked = await page.request.delete(`/api/prompts/${promptId}/share`, { headers });
      expect(revoked.status()).toBe(200);
      expect((await visitor.goto(`/geteilt/${token}`))?.status()).toBe(404);
    } finally {
      await removeAccount(other.id);
    }
  });
});
