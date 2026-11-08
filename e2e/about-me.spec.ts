import { test, expect, adminClient } from "./support/fixtures";

// "Über mich" gegen den lokalen Stack (Migration 0056): die Karte in den Einstellungen schreibt profiles.about_me
// direkt über den Browser-Client, also gelten das Spaltenrecht und die Längengrenze der Datenbank wirklich.

test.describe("Über mich", () => {
  test("speichert die Angaben und lädt sie wieder", async ({ signedIn: { page, account } }) => {
    await page.goto("/settings");
    const field = page.getByLabel("Über mich", { exact: true });
    await field.fill("Lehrerin, schreibe auf Deutsch, mag einen lockeren Ton");
    await page.getByRole("button", { name: "Speichern", exact: true }).first().click();
    await expect(page.getByText("Gespeichert. Ich nehme es ab dem nächsten Chat mit.")).toBeVisible();

    const { data } = await adminClient().from("profiles").select("about_me").eq("id", account.id).single();
    expect(data?.about_me).toBe("Lehrerin, schreibe auf Deutsch, mag einen lockeren Ton");

    await page.reload();
    await expect(page.getByLabel("Über mich", { exact: true })).toHaveValue("Lehrerin, schreibe auf Deutsch, mag einen lockeren Ton");

    // Die Grenze steht in der Datenbank, nicht nur im Formular.
    const tooLong = await adminClient().from("profiles").update({ about_me: "x".repeat(1001) }).eq("id", account.id);
    expect(tooLong.error?.code).toBe("23514");
  });
});
