import { readFile } from "node:fs/promises";
import { test, expect, adminClient, createAccount, makePro, removeAccount, sendFirstMessage } from "./support/fixtures";

// Das Konto gehört dem Nutzer: er kann seine Daten mitnehmen, die Sprache
// wählen und das Konto samt allem Gespeicherten wieder löschen.

test.describe("Konto", () => {
  test("der Datenexport enthält die eigenen Daten, aber nichts Fremdes und keine Geheimnisse", async ({
    signedIn: { page, account },
  }) => {
    await makePro(account);
    await sendFirstMessage(page, "Frage für den Export", { name: "briefing.txt", content: "Inhalt der Datei" });

    // Ein zweites Konto mit einem Chat: sein Inhalt darf im Export des ersten
    // nirgends auftauchen (RLS plus das ausdrückliche user_id-Filtern).
    const other = await createAccount("other");
    try {
      const admin = adminClient();
      const { data: conversation } = await admin
        .from("conversations")
        .insert({ user_id: other.id, title: "GEHEIMER-TITEL-DES-ANDEREN" })
        .select("id")
        .single();
      await admin.from("messages").insert({
        conversation_id: conversation!.id,
        user_id: other.id,
        role: "user",
        content: "GEHEIME-NACHRICHT-DES-ANDEREN",
      });

      await page.goto("/settings");
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("link", { name: "Daten herunterladen" }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^promptprinter-export-\d{4}-\d{2}-\d{2}\.json$/);

      const raw = await readFile((await download.path())!, "utf8");
      const data = JSON.parse(raw);

      expect(data.exportVersion).toBe(1);
      expect(data.messages.map((m: { content: string }) => m.content)).toContain("Frage für den Export");
      expect(data.messageAttachments).toHaveLength(1);
      expect(data.messageAttachments[0].name).toBe("briefing.txt");

      // Nichts Fremdes, und keine Geheimnisse oder Interna.
      expect(raw).not.toContain("GEHEIME");
      expect(raw).not.toMatch(/storage_path|storagePath|encrypted_key|service_role/);
      expect(raw).not.toContain("Inhalt der Datei"); // Dateiinhalte sind bewusst nicht dabei
    } finally {
      await removeAccount(other.id);
    }
  });

  test("die Sprache lässt sich wechseln und bleibt nach dem Neuladen und am Konto erhalten", async ({
    signedIn: { page, account },
  }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Einstellungen", level: 1 })).toBeVisible();

    await page.getByRole("radio", { name: /English/ }).click();
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();

    // Für ein anderes Gerät steht die Sprache auch im Profil.
    await expect
      .poll(async () => {
        const { data } = await adminClient().from("profiles").select("settings").eq("id", account.id).maybeSingle();
        return (data?.settings as { locale?: string } | null)?.locale;
      })
      .toBe("en");
  });

  test("Konto löschen entfernt Nutzer, Chats und die Dateien im Speicher", async ({
    signedIn: { page, account },
  }) => {
    await makePro(account);
    const admin = adminClient();
    await sendFirstMessage(page, "Frage vor dem Löschen", { name: "weg.txt", content: "wird gelöscht" });

    const { data: attachment } = await admin
      .from("message_attachments")
      .select("storage_path")
      .eq("user_id", account.id)
      .single();
    const before = await admin.storage.from("chat-attachments").download(attachment!.storage_path);
    expect(before.error, "die Datei liegt vor dem Löschen im Speicher").toBeNull();

    await page.goto("/settings");
    await page.getByRole("button", { name: "Löschen" }).last().click();
    const dialog = page.getByRole("dialog", { name: /Konto/ });
    await dialog.getByPlaceholder(account.email).fill(account.email);
    await dialog.getByRole("button", { name: "Konto löschen" }).click();

    // Danach ist die Sitzung zu: die App führt wieder auf die Anmeldung.
    await expect(page).toHaveURL(/\/($|login)/, { timeout: 30_000 });
    await page.goto("/chats/new");
    await expect(page).toHaveURL(/\/login/);

    // Das Konto gibt es nicht mehr, und alles, was daran hing, auch nicht.
    const lookup = await admin.auth.admin.getUserById(account.id);
    expect(lookup.data.user).toBeNull();
    expect((await admin.from("conversations").select("id").eq("user_id", account.id)).data).toHaveLength(0);
    expect((await admin.from("messages").select("id").eq("user_id", account.id)).data).toHaveLength(0);
    expect((await admin.from("message_attachments").select("id").eq("user_id", account.id)).data).toHaveLength(0);
    const after = await admin.storage.from("chat-attachments").download(attachment!.storage_path);
    expect(after.error, "die Datei darf nach dem Löschen des Kontos nicht mehr im Speicher liegen").not.toBeNull();

    // Anmelden mit den alten Zugangsdaten geht nicht mehr.
    const res = await page.request.post("/api/auth", {
      data: { action: "sign-in", email: account.email, password: account.password },
    });
    expect(res.status()).toBe(400);
  });
});
