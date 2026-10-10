import { test, expect, adminClient, makePro } from "./support/fixtures";

// Der Kern des Produkts: Frage senden, Antwort bekommen, nach dem Neuladen ist
// beides noch da. Chat läuft im Stub-Modus (kein Modell-Anbieter in der
// Test-Umgebung): die Antwort ist die Demo-Antwort aus
// features/chat/lib/chat-stub.ts. Dass die ECHTE Antwort stimmt, prüft ein
// Smoketest nicht, das ist Sache von llm.test.ts und der Route-Tests.

const QUESTION = "Ich möchte eine App für Hundetrainer bauen";

test.describe("Chat", () => {
  test("Frage senden, Demo-Antwort kommt, nach dem Neuladen ist alles noch da", async ({
    signedIn: { page, account },
  }) => {
    await makePro(account);

    await page.goto("/chats/new");
    await page.getByLabel("Nachricht an Finn").fill(QUESTION);
    await page.getByRole("button", { name: "Senden" }).click();

    // Die Demo-Antwort beweist nebenbei, dass kein echter Modell-Anbieter
    // gefragt wurde, auch wenn `.env.local` einen Z.ai-Key trägt.
    await expect(page.getByText("Demo-Antwort")).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/chats\/[0-9a-f-]{36}/);

    await page.reload();
    const transcript = page.getByRole("log");
    await expect(transcript.getByText(QUESTION, { exact: true })).toBeVisible();
    await expect(transcript.getByText("Demo-Antwort")).toBeVisible();

    // In der Datenbank: genau eine Frage und eine Antwort, in dieser Reihenfolge.
    const { data: messages } = await adminClient()
      .from("messages")
      .select("role, content")
      .eq("user_id", account.id)
      .order("created_at", { ascending: true });
    expect(messages?.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(messages?.[0].content).toBe(QUESTION);
  });

  test("ein Textanhang wird mit der Frage gespeichert und ist nach dem Neuladen noch da", async ({
    signedIn: { page, account },
  }) => {
    await makePro(account);
    const fileText = "Zielgruppe: Hundetrainer in Zürich.\nWichtig: Terminbuchung per Handy.";

    await page.goto("/chats/new");
    await page.getByTestId("attachment-input").setInputFiles({
      name: "briefing.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(fileText, "utf8"),
    });
    // Der Anhang steht als Chip im Composer, bevor etwas gesendet wird.
    const tray = page.getByRole("list", { name: "Anhänge" });
    await expect(tray).toContainText("briefing.txt");

    await page.getByLabel("Nachricht an Finn").fill("Lies bitte das Briefing.");
    await page.getByRole("button", { name: "Senden" }).click();
    await expect(page.getByText("Demo-Antwort")).toBeVisible({ timeout: 30_000 });
    // Erst auf die Adresse des Chats warten: ein Neuladen auf /chats/new zeigte
    // den leeren Anfang, nicht den gespeicherten Verlauf.
    await expect(page).toHaveURL(/\/chats\/[0-9a-f-]{36}/);

    // Nach dem Neuladen hängt der Anhang noch an der Nachricht: er kommt aus der
    // Datenbank, nicht aus dem Zustand der Seite.
    await page.reload();
    await expect(page.getByRole("list", { name: "Anhänge" })).toContainText("briefing.txt");

    // Gegenprobe an der Quelle: Zeile UND Datei im Speicher, und die Datei ist
    // byte-gleich mit dem, was hochgeladen wurde.
    const admin = adminClient();
    const { data: rows } = await admin
      .from("message_attachments")
      .select("name, kind, media_type, size_bytes, storage_path")
      .eq("user_id", account.id);
    expect(rows).toHaveLength(1);
    expect(rows?.[0]).toMatchObject({
      name: "briefing.txt",
      kind: "text",
      media_type: "text/plain",
      size_bytes: Buffer.byteLength(fileText, "utf8"),
    });
    expect(rows?.[0].storage_path.startsWith(`${account.id}/`)).toBe(true);

    const { data: blob, error } = await admin.storage.from("chat-attachments").download(rows![0].storage_path);
    expect(error).toBeNull();
    expect(await blob!.text()).toBe(fileText);
  });

  test("ein frisches Free-Konto sieht den Key-Hinweis, bevor es tippt, und nach dem Senden keinen Fehler zum Wiederholen", async ({
    signedIn: { page },
  }) => {
    await page.goto("/chats/new");
    await expect(page.getByText("Bevor wir loslegen, brauche ich deinen eigenen KI-Key.")).toBeVisible();
    // Der Hinweis nimmt den Key seit dem Key-Assistenten gleich selbst an. Der Link
    // zu den Einstellungen ist der Weg für einen anderen Anbieter.
    await expect(
      page.getByRole("link", { name: "Anderer Anbieter? Zu den Einstellungen" })
    ).toHaveAttribute("href", "/settings#api-keys");

    // Sendet es trotzdem, lehnt der Server mit 403 ab (byokRequired). Die Seite
    // zeigt dann denselben Hinweis, keinen "Erneut versuchen"-Knopf, der denselben
    // 403 nur wiederholte (Audit 23.09.2026, F-1).
    await page.getByLabel("Nachricht an Finn").fill("Hallo");
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/chat") && r.request().method() === "POST"),
      page.getByRole("button", { name: "Senden" }).click(),
    ]);
    expect(response.status()).toBe(403);
    await expect(page.getByText("Bevor wir loslegen, brauche ich deinen eigenen KI-Key.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Erneut/ })).toHaveCount(0);
  });
});
