import { test, expect } from "@playwright/test";
import { TEST_PASSWORD, adminClient, removeAccountByEmail, uniqueEmail } from "./support/fixtures";

// Registrieren, abmelden, anmelden: der Weg, den jeder neue Nutzer als Erstes
// geht, und der einzige Test, der die Formulare selbst bedient. Alle anderen
// Tests melden über dieselbe Route an (support/fixtures.ts, signIn), ohne sie
// jedes Mal durchzuklicken.

test("Registrieren, Abmelden und wieder Anmelden über die Formulare", async ({ page }) => {
  const email = uniqueEmail("signup");
  try {
    await page.goto("/signup");
    await page.locator("#signup-email").fill(email);
    await page.locator("#signup-password").fill(TEST_PASSWORD);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Konto erstellen" }).click();

    // Lokal ohne Bestätigungsmail (supabase/config.toml): die Sitzung steht sofort,
    // und nach der kurzen Begrüssung landet das neue Konto im ersten Chat.
    await expect(page).toHaveURL(/\/chats\/new/, { timeout: 30_000 });
    await expect(page.getByLabel("Nachricht an Finn")).toBeVisible();

    // Das Konto gibt es wirklich, mit Profil (der Trigger handle_new_user lief).
    const admin = adminClient();
    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const created = users?.users.find((u) => u.email === email);
    expect(created, "Konto in auth.users").toBeTruthy();
    const { data: profile } = await admin.from("profiles").select("id").eq("id", created!.id).maybeSingle();
    expect(profile, "Profil-Zeile (handle_new_user)").toBeTruthy();

    // Abmelden über das Kontomenü.
    await page.getByRole("button", { name: "Kontomenü" }).click();
    await page.getByRole("button", { name: "Abmelden" }).click();
    await expect(page).toHaveURL(/\/($|login)/, { timeout: 20_000 });

    // Ohne Sitzung ist die App zu.
    await page.goto("/chats/new");
    await expect(page).toHaveURL(/\/login/);

    // Anmelden mit denselben Zugangsdaten.
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Einloggen" }).click();
    await expect(page).toHaveURL(/\/chats\/new/, { timeout: 30_000 });
  } finally {
    await removeAccountByEmail(email);
  }
});

test("ein falsches Passwort wird abgewiesen, ohne zu verraten, was genau falsch war", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#login-email").fill(uniqueEmail("nobody"));
  await page.locator("#login-password").fill("Falsches-Passwort-123!");
  await page.getByRole("button", { name: "Einloggen" }).click();
  // Nur im Formular: Next hängt selbst ein unsichtbares role="alert" für Routenwechsel an.
  const alert = page.locator("form").getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/falsch/i);
  await expect(page).toHaveURL(/\/login/);
});

test("ein naheliegendes Passwort kommt bei der Registrierung nicht durch (Schranke im Server)", async ({
  request,
}) => {
  const email = uniqueEmail("weak");
  try {
    const res = await request.post("/api/auth", {
      data: { action: "sign-up", email, password: "passwort123" },
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toMatchObject({ kind: "weak-password" });
    // Und es wurde kein Konto angelegt.
    const { data } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 200 });
    expect(data?.users.some((u) => u.email === email)).toBe(false);
  } finally {
    await removeAccountByEmail(email);
  }
});
