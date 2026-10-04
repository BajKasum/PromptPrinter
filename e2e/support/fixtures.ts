import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { test as base, expect, type Page } from "@playwright/test";
import { localSupabase } from "./env";

// Gemeinsame Bausteine der Smoketests: ein frisches Konto pro Test, das Anmelden
// auf dem schnellen Weg, und ein Zugriff mit Admin-Rechten NUR zum Aufräumen und
// zum Gegenprüfen dessen, was die Oberfläche behauptet.

/**
 * Besteht weakPasswordReason() (shared/lib/password.ts): lang genug, kein
 * bekanntes Passwort, kein Muster, nichts aus der E-Mail-Adresse.
 */
export const TEST_PASSWORD = "Kiefer-Wolke-Ozean-84!";

/** Der Admin-Client des LOKALEN Stacks (localSupabase() verweigert alles andere). */
export function adminClient() {
  const { url, serviceRoleKey } = localSupabase();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function uniqueEmail(label: string): string {
  return `e2e-${label}-${randomUUID().slice(0, 8)}@example.test`;
}

export type Account = { id: string; email: string; password: string };

export async function createAccount(label: string): Promise<Account> {
  const email = uniqueEmail(label);
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`E2E: Konto konnte nicht angelegt werden: ${error?.message}`);
  return { id: data.user.id, email, password: TEST_PASSWORD };
}

/**
 * Free chattet nur mit eigenem Key (requiresOwnKey, shared/lib/plans.ts): ein
 * frisches Konto sieht im Chat einen Hinweis statt der Eingabe. Wer den Chat
 * selbst prüfen will, braucht ein Konto, das auf dem Server-Key läuft. Direkt in
 * der Datenbank gesetzt, nicht über den Zahlungsweg: der gehört nicht hierher.
 */
export async function makePro(account: Account): Promise<void> {
  const { error } = await adminClient().from("profiles").update({ plan: "pro" }).eq("id", account.id);
  if (error) throw new Error(`E2E: Plan konnte nicht gesetzt werden: ${error.message}`);
}

/** Räumt auf; ein schon gelöschtes Konto (der Löschtest) ist kein Fehler. */
export async function removeAccount(id: string): Promise<void> {
  await adminClient().auth.admin.deleteUser(id);
}

/**
 * Meldet über dieselbe Route an wie das Formular (/api/auth), ohne das Formular
 * selbst zu bedienen: die Sitzungs-Cookies landen im Browser-Kontext der Seite.
 * Das Formular prüft auth.spec.ts einmal gründlich, jeder andere Test soll nicht
 * jedes Mal denselben Weg durchklicken.
 */
export async function signIn(page: Page, account: Account): Promise<void> {
  const res = await page.request.post("/api/auth", {
    data: { action: "sign-in", email: account.email, password: account.password },
  });
  expect(res.status(), `Anmelden über /api/auth: ${await res.text()}`).toBe(200);
}

type Fixtures = {
  /** Ein frisches Konto, nach dem Test gelöscht. */
  account: Account;
  /** Eine Seite, in der dieses Konto schon angemeldet ist. */
  signedIn: { page: Page; account: Account };
};

export const test = base.extend<Fixtures>({
  account: async ({}, use, testInfo) => {
    const account = await createAccount(testInfo.title.replace(/\W+/g, "-").slice(0, 20).toLowerCase());
    await use(account);
    await removeAccount(account.id);
  },
  signedIn: async ({ page, account }, use) => {
    await signIn(page, account);
    await use({ page, account });
  },
});

export { expect };

/** Für Konten, die ein Test selbst über die Oberfläche angelegt hat (auth.spec.ts). */
export async function removeAccountByEmail(email: string): Promise<void> {
  const admin = adminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const user = data?.users.find((u) => u.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
}

/**
 * Schickt die erste Nachricht eines neuen Chats (Stub-Modus) und wartet, bis der
 * Chat unter seiner eigenen Adresse steht. Mit `file` hängt eine Textdatei dran.
 * Gibt die Konversations-ID zurück.
 */
export async function sendFirstMessage(
  page: Page,
  text: string,
  file?: { name: string; content: string }
): Promise<string> {
  await page.goto("/chats/new");
  if (file) {
    await page.getByTestId("attachment-input").setInputFiles({
      name: file.name,
      mimeType: "text/plain",
      buffer: Buffer.from(file.content, "utf8"),
    });
    await expect(page.getByRole("list", { name: "Anhänge" })).toContainText(file.name);
  }
  await page.getByLabel("Nachricht an Finn").fill(text);
  await page.getByRole("button", { name: "Senden" }).click();
  await expect(page.getByText("Demo-Antwort")).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/chats\/[0-9a-f-]{36}/);
  return page.url().match(/\/chats\/([0-9a-f-]{36})/)![1];
}
