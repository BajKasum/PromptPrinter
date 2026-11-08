import { test, expect, adminClient, createAccount, removeAccount } from "./support/fixtures";
import { E2E_ORIGIN } from "./support/env";

// Die gespeicherten Prompts aus Sicht des Terminals (api/cli/prompts), gegen den lokalen Stack: echte Sitzung aus
// der Geräte-Code-Anmeldung, echtes PostgREST mit `ilike` auf dem JSON-Pfad, echte RLS. Ein zweites Konto hält
// eine Zeile, die weder in der Liste noch über ihre ID erscheinen darf.

test.describe("Gespeicherte Prompts aus Sicht des Terminals", () => {
  test("listet, sucht und liest nur die eigenen Prompts", async ({ signedIn: { page, account }, request: cli }) => {
    const other = await createAccount("cli-prompts-fremd");
    try {
      const admin = adminClient();
      const insert = async (userId: string, title: string, prompt: string, createdAt: string) => {
        const { data, error } = await admin
          .from("saved_prompts")
          .insert({ user_id: userId, project_id: null, outputs: { title, prompt }, created_at: createdAt })
          .select("id")
          .single();
        expect(error).toBeNull();
        return data!.id as string;
      };
      const older = await insert(account.id, "Mail ans Team", "Schreib eine Mail: 50% Rabatt_bis Freitag", "2026-11-01T10:00:00Z");
      const newer = await insert(account.id, "Wochenplan", "Plane die Woche, (Montag) bis Freitag", "2026-11-02T10:00:00Z");
      const foreign = await insert(other.id, "Fremd", "Schreib eine Mail an jemand anderen", "2026-11-03T10:00:00Z");

      const device = await (await cli.post("/api/cli/device", { data: { clientName: "e2e-prompts" } })).json();
      const approved = await page.request.post("/api/cli/approve", {
        headers: { origin: E2E_ORIGIN },
        data: { userCode: device.userCode, action: "approve" },
      });
      expect(approved.status(), await approved.text()).toBe(200);
      const claimed = await (await cli.post("/api/cli/token", { data: { deviceCode: device.deviceCode } })).json();
      const headers = { authorization: `Bearer ${claimed.session.access_token}` };
      const ids = async (path: string) => {
        const res = await cli.get(path, { headers });
        expect(res.status(), await res.text()).toBe(200);
        return ((await res.json()).prompts as { id: string }[]).map((p) => p.id);
      };

      expect(await ids("/api/cli/prompts")).toEqual([newer, older]);
      expect(await ids("/api/cli/prompts?limit=1")).toEqual([newer]);
      // Titel und Text, ohne Gross/Klein; die fremde Mail bleibt draussen.
      expect(await ids("/api/cli/prompts?q=MAIL")).toEqual([older]);
      expect(await ids("/api/cli/prompts?q=wochenplan")).toEqual([newer]);
      // Sonderzeichen sind Text: `%` und `_` treffen nur sich selbst, Komma und Klammern brechen nichts.
      expect(await ids(`/api/cli/prompts?q=${encodeURIComponent("50% Rabatt_bis")}`)).toEqual([older]);
      expect(await ids(`/api/cli/prompts?q=${encodeURIComponent("5_%")}`)).toEqual([]);
      expect(await ids(`/api/cli/prompts?q=${encodeURIComponent("Woche, (Montag)")}`)).toEqual([newer]);
      expect(await ids(`/api/cli/prompts?q=${encodeURIComponent(")or(user_id.neq.x")}`)).toEqual([]);

      const one = await cli.get(`/api/cli/prompts/${newer}`, { headers });
      expect(await one.json()).toMatchObject({ id: newer, title: "Wochenplan", content: "Plane die Woche, (Montag) bis Freitag" });
      const theirs = await cli.get(`/api/cli/prompts/${foreign}`, { headers });
      expect(theirs.status()).toBe(404);
      expect((await theirs.json()).kind).toBe("notFound");

      // Das Cookie der Seite gilt hier nicht: die Routen sind nur für das Terminal.
      expect((await page.request.get("/api/cli/prompts")).status()).toBe(401);
      expect((await page.request.get(`/api/cli/prompts/${newer}`)).status()).toBe(401);
    } finally {
      await removeAccount(other.id);
    }
  });
});
