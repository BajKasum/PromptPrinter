import { adminClient, expect, makeAdmin, sendFirstMessage, test, type Account } from "./support/fixtures";

// Versionen gespeicherter Prompts in der Oberfläche: Speichern im selben Chat und im Chat aus "Als Ausgangspunkt
// nutzen" fragt nach der Version, an der Karte Text bearbeiten, Verlauf vergleichen, wiederherstellen. Der Chat läuft
// im Stub-Modus; seine Demo-Antwort trägt die Frage in den Prompt-Block, also gibt jede Frage einen anderen Prompt.
// Was die Datenbank selbst durchsetzt (Rechte, Grenze), prüft prompt-versions-db.spec.ts.

async function versions(promptId: string): Promise<string[]> {
  const { data, error } = await adminClient()
    .from("saved_prompt_versions")
    .select("version, content")
    .eq("prompt_id", promptId)
    .order("version");
  expect(error).toBeNull();
  return (data ?? []).map((v) => v.content as string);
}

async function savedPrompts(account: Account): Promise<{ id: string; outputs: { prompt: string; title: string } }[]> {
  const { data, error } = await adminClient().from("saved_prompts").select("id, outputs").eq("user_id", account.id);
  expect(error).toBeNull();
  return (data ?? []) as { id: string; outputs: { prompt: string; title: string } }[];
}

test.describe("Versionen gespeicherter Prompts", () => {
  test.setTimeout(120_000);

  test("zweimal speichern im selben Chat fragt nach der Version", async ({ signedIn: { page, account } }) => {
    await makeAdmin(account);
    await sendFirstMessage(page, "Ein Brief an meinen Vermieter");

    const result = page.getByRole("region", { name: "Aktuelle Antwort von Finn" });
    // Der erste Prompt dieses Chats: ein Klick, nichts zu fragen.
    const first = result.getByRole("button", { name: "Speichern" });
    await expect(first).not.toHaveAttribute("aria-expanded");
    await first.click();
    await expect(result.getByRole("button", { name: "Gespeichert" })).toBeVisible();
    await expect.poll(async () => (await savedPrompts(account)).length).toBe(1);

    await page.getByLabel("Nachricht an Finn").fill("Mach ihn kürzer und freundlicher");
    await page.getByRole("button", { name: "Senden" }).click();
    await expect(page.getByText("Demo-Antwort")).toHaveCount(2, { timeout: 30_000 });

    const save = page.getByRole("region", { name: "Aktuelle Antwort von Finn" }).getByRole("button", { name: "Speichern" });
    await expect(save).toHaveAttribute("aria-expanded", "false");
    await save.click();
    await page.getByRole("button", { name: /Als neue Version/ }).click();
    await expect(page.getByText(/Neue Version von „.+“ gespeichert/).first()).toBeVisible();

    const rows = await savedPrompts(account);
    expect(rows).toHaveLength(1);
    const history = await versions(rows[0].id);
    expect(history).toHaveLength(2);
    expect(history[0]).toContain("Ein Brief an meinen Vermieter");
    expect(history[1]).toContain("Mach ihn kürzer und freundlicher");
    expect(rows[0].outputs.prompt).toBe(history[1]);
  });

  test("ein Chat aus \"Als Ausgangspunkt nutzen\" bietet die Version des Ursprungs an", async ({
    signedIn: { page, account },
  }) => {
    await makeAdmin(account);
    const { data: source, error } = await adminClient()
      .from("saved_prompts")
      .insert({ user_id: account.id, outputs: { prompt: "Schreib eine Einladung zum Grillfest.", title: "Einladung" } })
      .select("id")
      .single();
    expect(error).toBeNull();

    await page.goto(`/chats/new?from=${source!.id}`);
    await expect(page.getByLabel("Nachricht an Finn")).toHaveValue(/Schreib eine Einladung zum Grillfest\./);
    await page.getByRole("button", { name: "Senden" }).click();
    await expect(page.getByText("Demo-Antwort")).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/chats\/[0-9a-f-]{36}/);
    const chatId = page.url().match(/\/chats\/([0-9a-f-]{36})/)![1];

    // Der Chat kennt seinen Ursprung.
    const { data: chat } = await adminClient().from("conversations").select("source_prompt_id").eq("id", chatId).single();
    expect(chat?.source_prompt_id).toBe(source!.id);

    const result = page.getByRole("region", { name: "Aktuelle Antwort von Finn" });
    await result.getByRole("button", { name: "Speichern" }).click();
    const asVersion = page.getByRole("button", { name: /Als neue Version/ });
    await expect(asVersion).toContainText("von „Einladung“");
    await asVersion.click();
    await expect(page.getByText("Neue Version von „Einladung“ gespeichert").first()).toBeVisible();

    expect(await savedPrompts(account)).toHaveLength(1);
    const history = await versions(source!.id);
    expect(history).toHaveLength(2);
    expect(history[0]).toBe("Schreib eine Einladung zum Grillfest.");
  });

  test("Text an der Karte bearbeiten, Verlauf vergleichen, wiederherstellen; Umbenennen legt keine Version an", async ({
    signedIn: { page, account },
  }) => {
    const { data: row, error } = await adminClient()
      .from("saved_prompts")
      .insert({ user_id: account.id, outputs: { prompt: "Schreib im Ton: locker.", title: "Tonfall" } })
      .select("id")
      .single();
    expect(error).toBeNull();

    await page.goto("/prompts");
    await page.getByRole("button", { name: "Tonfall", exact: true }).click();
    // Mit einer Version gibt es noch keinen Verlauf.
    await expect(page.getByRole("button", { name: /^Verlauf/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Text von „Tonfall“ bearbeiten" }).click();
    const field = page.getByLabel("Text von „Tonfall“", { exact: true });
    await field.fill("Schreib im Ton: förmlich.");
    await page.getByRole("button", { name: "Als neue Version speichern" }).click();
    await expect(page.getByText("Neue Version gespeichert", { exact: true }).first()).toBeVisible();
    await expect(page.locator("pre", { hasText: "Schreib im Ton: förmlich." })).toBeVisible();

    const toggle = page.getByRole("button", { name: "Verlauf (2 Versionen)" });
    await toggle.click();
    const diff = page.getByRole("group", { name: "Unterschied von Version 1 zu Version 2" });
    await expect(diff.locator("del")).toHaveText("entfernt: locker.");
    await expect(diff.locator("ins")).toHaveText("eingefügt: förmlich.");

    await page.getByRole("button", { name: "Version 1 wiederherstellen" }).click();
    await expect(page.getByText("Version 1 ist wieder aktuell, als Version 3").first()).toBeVisible();
    await expect(page.locator("pre", { hasText: "Schreib im Ton: locker." })).toBeVisible();
    expect(await versions(row!.id)).toEqual([
      "Schreib im Ton: locker.",
      "Schreib im Ton: förmlich.",
      "Schreib im Ton: locker.",
    ]);

    // Umbenennen ändert nur den Titel: keine neue Version.
    await page.getByRole("button", { name: "„Tonfall“ umbenennen" }).click();
    await page.getByLabel("Neuer Name für den Prompt").fill("Tonfall neu");
    await page.getByLabel("Neuer Name für den Prompt").press("Enter");
    await expect(page.getByRole("button", { name: "Tonfall neu", exact: true })).toBeVisible();
    await expect.poll(async () => (await savedPrompts(account))[0]?.outputs.title).toBe("Tonfall neu");
    expect(await versions(row!.id)).toHaveLength(3);
  });
});
