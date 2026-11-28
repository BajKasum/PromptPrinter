import { randomUUID } from "node:crypto";
import { test, expect, adminClient } from "./support/fixtures";
import { E2E_ORIGIN } from "./support/env";

// Die Befehlspalette (Strg+K, ohne sichtbaren Knopf): öffnen, Chats und Projekte aus der Datenbank finden, mit der
// Tastatur und mit der Maus dorthin, mit Escape schliessen, und nicht unter einem offenen Dialog.

test.describe("Befehlspalette", () => {
  test("finden und öffnen, schliessen, nicht unter einem Dialog", async ({ signedIn: { page, account } }) => {
    const admin = adminClient();
    const mark = randomUUID().slice(0, 8);
    const insert = async (table: "conversations" | "projects", values: Record<string, unknown>) => {
      const { data, error } = await admin.from(table).insert({ user_id: account.id, ...values }).select("id").single();
      expect(error).toBeNull();
      return data!.id as string;
    };
    const chatTitle = `Reiseplan ${mark}`;
    const projectName = `Gartenbau ${mark}`;
    const chatId = await insert("conversations", { title: chatTitle });
    const projectId = await insert("projects", { name: projectName });

    await page.goto("/chats/new");
    const palette = page.getByRole("dialog", { name: "Suche" });
    const search = palette.getByRole("textbox", { name: "Suchen" });
    // Das Kürzel hört erst zu, wenn die Seite hydriert ist.
    await expect(async () => {
      await page.keyboard.press("Control+k");
      await expect(palette).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    await expect(search).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();

    // ── Ein Chat, mit der Tastatur ───────────────────────────────────────────
    await page.keyboard.press("Control+k");
    await expect(search).toBeFocused();
    await search.fill(chatTitle.toLowerCase());
    await expect(palette.getByRole("button", { name: chatTitle })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(`${E2E_ORIGIN}/chats/${chatId}`);
    await expect(palette).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: chatTitle })).toBeVisible();

    // ── Ein Projekt, mit der Maus ────────────────────────────────────────────
    await page.keyboard.press("Control+k");
    await search.fill("gartenbau");
    await palette.getByRole("button", { name: projectName }).click();
    await expect(page).toHaveURL(`${E2E_ORIGIN}/projects/${projectId}`);

    await page.keyboard.press("Control+k");
    await search.fill(`nichts-${mark}-passt`);
    await expect(palette.getByText(`Keine Treffer für „nichts-${mark}-passt“`)).toBeVisible();
    await page.keyboard.press("Escape");

    // ── Unter einem offenen Dialog geht sie nicht auf ────────────────────────
    await page.goto("/projects");
    const newProject = page.getByRole("dialog", { name: "Neues Projekt anlegen" });
    await expect(async () => {
      await page.getByRole("main").getByRole("button", { name: "Neues Projekt" }).click();
      await expect(newProject).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    await expect(newProject.getByLabel("Projektname")).toBeFocused();
    await page.keyboard.press("Control+k");
    await page.keyboard.press("Escape");
    // Das Escape traf den einen offenen Dialog: darunter oder darüber lag keine Palette.
    await expect(newProject).toBeHidden();
    await expect(palette).toHaveCount(0);
  });
});
