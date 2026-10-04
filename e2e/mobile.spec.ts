import { test, expect, makePro, sendFirstMessage } from "./support/fixtures";

// Mit Telefonmaß (Pixel 7, Touch). Ein Smoketest für die Fehlerklasse, die auf
// dem Schreibtisch nie auffällt: Inhalt, der über den Rand läuft, ein Menü, das
// sich nicht öffnen lässt, ein Eingabefeld, das unter etwas liegt.

/** True, wenn die Seite seitwärts scrollen lässt, also etwas über den Rand ragt. */
async function overflowsHorizontally(page: import("@playwright/test").Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

test.describe("Telefon", () => {
  test("öffentliche Seiten laufen nicht über den Rand", async ({ page }) => {
    for (const path of ["/", "/pricing", "/login", "/signup"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await overflowsHorizontally(page), `${path} scrollt seitwärts`).toBe(false);
    }
  });

  test("Menü öffnen, Chat führen, die App-Seiten laufen nicht über den Rand", async ({
    signedIn: { page, account },
  }) => {
    await makePro(account);

    await page.goto("/chats/new");
    // Auf dem Telefon gibt es keine feste Seitenleiste, sondern das Menü.
    await expect(page.getByRole("complementary")).toBeHidden();
    await page.getByRole("button", { name: "Menü öffnen" }).click();
    const nav = page.getByRole("navigation", { name: "Chats" });
    await expect(nav).toBeVisible();
    await page.getByRole("button", { name: "Menü schliessen" }).first().click();
    await expect(nav).toBeHidden();

    // Der Chat ist mit Touch bedienbar: Frage senden, Antwort lesen, Eingabe
    // bleibt erreichbar.
    await sendFirstMessage(page, "Frage vom Telefon");
    await expect(page.getByLabel("Nachricht an Finn")).toBeVisible();
    expect(await overflowsHorizontally(page), "der Chat scrollt seitwärts").toBe(false);

    for (const path of ["/chats", "/projects", "/settings", "/usage", "/prompts"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await overflowsHorizontally(page), `${path} scrollt seitwärts`).toBe(false);
    }
  });
});
