import { test, expect, adminClient, makePro } from "./support/fixtures";

// Ein Projekt ist der Arbeitsraum: anlegen, Anweisungen und Dateien an einem
// Ort, ein Chat darin, und beim Löschen verschwindet alles samt der Dateien im
// Speicher. Das Löschen ist der Teil, den ein Unit-Test nicht belegen kann: ob
// im Bucket wirklich nichts liegen bleibt, zeigt nur der echte Speicher.

test.describe("Projekte", () => {
  test("anlegen, Anweisungen und Datei halten, Chat im Projekt, Löschen räumt alles auf", async ({
    signedIn: { page, account },
  }) => {
    await makePro(account);
    const admin = adminClient();

    // ── Anlegen ───────────────────────────────────────────────────────────
    await page.goto("/projects");
    await page.getByRole("button", { name: "Neues Projekt" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Neues Projekt anlegen" });
    await dialog.getByLabel("Projektname").fill("Hundeschule");
    await dialog.getByRole("button", { name: "Projekt anlegen" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const projectId = page.url().match(/\/projects\/([0-9a-f-]{36})/)![1];

    const { data: project } = await admin
      .from("projects")
      .select("name, user_id")
      .eq("id", projectId)
      .maybeSingle();
    expect(project).toMatchObject({ name: "Hundeschule", user_id: account.id });

    // ── Anweisungen: gespeichert beim Verlassen des Feldes, nach dem Neuladen da ──
    const instructions = page.getByLabel("Projekt-Anweisungen");
    await instructions.fill("Immer in der Du-Form, kurz und freundlich.");
    await instructions.blur();
    await expect
      .poll(async () => {
        const { data } = await admin.from("projects").select("instructions").eq("id", projectId).maybeSingle();
        return data?.instructions;
      })
      .toBe("Immer in der Du-Form, kurz und freundlich.");
    await page.reload();
    await expect(page.getByLabel("Projekt-Anweisungen")).toHaveValue("Immer in der Du-Form, kurz und freundlich.");

    // ── Datei hochladen: Zeile UND Objekt im Speicher ────────────────────────
    const fileText = "# Notizen\n\nKunden buchen Termine per Handy.";
    await page.locator('input[type="file"]').setInputFiles({
      name: "notizen.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(fileText, "utf8"),
    });
    await expect(page.getByText("notizen.md")).toBeVisible({ timeout: 30_000 });

    const { data: files } = await admin
      .from("project_files")
      .select("name, storage_path")
      .eq("project_id", projectId);
    expect(files).toHaveLength(1);
    expect(files?.[0].name).toBe("notizen.md");
    const stored = await admin.storage.from("project-files").download(files![0].storage_path);
    expect(stored.error).toBeNull();
    expect(await stored.data!.text()).toBe(fileText);

    // ── Ein Chat im Projekt gehört zum Projekt ──────────────────────────────
    await page.getByRole("link", { name: /Neuen Chat starten|Neuer Chat in diesem Projekt/ }).first().click();
    await page.getByLabel("Nachricht an Finn").fill("Wie baue ich die Terminbuchung?");
    await page.getByRole("button", { name: "Senden" }).click();
    await expect(page.getByText("Demo-Antwort")).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(async () => {
        const { data } = await admin.from("conversations").select("project_id").eq("user_id", account.id);
        return data?.map((c) => c.project_id);
      })
      .toEqual([projectId]);

    // ── Löschen: Projekt, Chat, Dateizeile UND Objekt sind weg ──────────────
    await page.goto(`/projects/${projectId}`);
    await page.getByRole("button", { name: "Löschen" }).first().click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Projekt löschen" })
      .click();
    await expect(page).toHaveURL(/\/projects$/, { timeout: 30_000 });

    expect((await admin.from("projects").select("id").eq("id", projectId)).data).toHaveLength(0);
    expect((await admin.from("conversations").select("id").eq("user_id", account.id)).data).toHaveLength(0);
    expect((await admin.from("project_files").select("id").eq("project_id", projectId)).data).toHaveLength(0);
    const leftover = await admin.storage.from("project-files").download(files![0].storage_path);
    expect(leftover.error, "das Objekt im Bucket muss nach dem Löschen des Projekts weg sein").not.toBeNull();
  });
});
