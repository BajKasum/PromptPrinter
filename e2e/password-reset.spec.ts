import { createClient } from "@supabase/supabase-js";
import { test, expect } from "./support/fixtures";
import { E2E_ORIGIN, localSupabase } from "./support/env";
import { deleteMailsFor, linkContaining, waitForMail } from "./support/mailbox";

// Der Passwort-Reset über die ECHTE Mail: Formular → Mail im Postfach → Link →
// neues Passwort → Anmeldung. Bis M9 (Betriebs-Audit) prüfte das kein Test: lokal
// ist die Bestätigungsmail aus, und der Reset-Link ist ein Zusammenspiel aus der
// Vorlage (supabase/templates/recovery.html), der Redirect-Liste und der Route
// /auth/callback, das erst in Produktion auffiel, wenn es brach.
//
// Geprüft wird die Vorlage aus dem Repository. Was im Dashboard der Produktion
// steht, sieht dieser Test nicht (docs/SETUP.md, "Auth-Mails").

const NEW_PASSWORD = "Birke-Sturm-Hafen-52!";

test("Passwort-Reset über die Mail: Link der Vorlage, neues Passwort, alte Zugangsdaten ungültig", async ({
  page,
  account,
}) => {
  try {
    await page.goto("/reset-password");
    await page.locator("#reset-email").fill(account.email);
    await page.getByRole("button", { name: /Link senden/ }).click();
    // Die Oberfläche bestätigt neutral, ob es die Adresse gibt oder nicht.
    await expect(page.getByText(account.email)).toBeVisible({ timeout: 20_000 });

    // Die Mail, die ein Mensch bekäme.
    const mail = await waitForMail(account.email);
    expect(mail.subject).toBe("Passwort zurücksetzen bei PromptPrinter");
    expect(mail.html).toContain('lang="de"');

    // Der Link läuft über /auth/callback der App (nicht über Supabases /verify),
    // trägt das `next` der App, den Token und den richtigen type.
    const link = linkContaining(mail.html, "token_hash=");
    const url = new URL(link);
    expect(url.origin, "Link zeigt auf die App der Tests, nicht auf die Site-URL des Stacks").toBe(E2E_ORIGIN);
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("next")).toBe("/reset-password/update");
    expect(url.searchParams.get("type")).toBe("recovery");
    expect(url.searchParams.get("token_hash")).toBeTruthy();

    // Der Link führt zur Seite für das neue Passwort, mit gültiger Reset-Sitzung.
    await page.goto(link);
    await expect(page).toHaveURL(/\/reset-password\/update/, { timeout: 30_000 });
    await page.locator("#new-password").fill(NEW_PASSWORD);
    await page.locator("#confirm-password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Passwort speichern" }).click();
    await expect(page).toHaveURL(/\/chats\/new/, { timeout: 30_000 });

    // Das neue Passwort gilt, das alte nicht mehr.
    const { url: supabaseUrl, anonKey } = localSupabase();
    const anon = () => createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const withNew = await anon().auth.signInWithPassword({ email: account.email, password: NEW_PASSWORD });
    expect(withNew.error, "Anmeldung mit dem neuen Passwort").toBeNull();
    const withOld = await anon().auth.signInWithPassword({ email: account.email, password: account.password });
    expect(withOld.error, "das alte Passwort muss ungültig sein").not.toBeNull();

    // Ein Reset-Link ist nur einmal gültig: ein zweiter Besuch führt nicht ins Konto.
    await page.context().clearCookies();
    await page.goto(link);
    await expect(page).toHaveURL(/\/login\?error=auth_callback_failed/, { timeout: 30_000 });
  } finally {
    await deleteMailsFor(account.email);
  }
});
