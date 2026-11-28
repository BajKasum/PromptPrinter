import { randomInt, randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { RESEND_FAIL_MARKER } from "./support/fakes.cjs";
import { outboundRequests } from "./support/outbound";
import { LEGAL } from "../src/shared/lib/legal";

// Das Kontaktformular auf /kontakt bis zum Versand: die Prüfung im Browser, die Route mit Ratenlimit und Schema und
// die Anfrage an Resend, die der Stellvertreter beantwortet (support/fakes.cjs). Keine Mail verlässt den Test.

type Mail = { from: string; to: string[]; reply_to?: string; subject: string; text: string };

const mails = () => outboundRequests("api.resend.com").map((r) => JSON.parse(r.body) as Mail);

async function openForm(page: Page) {
  // Je Test eine eigene Adresse: das Ratenlimit zählt je Adresse (fünf Nachrichten je Stunde).
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.9.${randomInt(256)}.${randomInt(1, 255)}` });
  await page.goto("/kontakt");
  const topic = page.getByRole("combobox", { name: "Worum geht es?" });
  // Der Hinweis zur Meldung erscheint erst durch den Zustand der Seite: vorher Eingetragenes zählt nicht.
  await expect(async () => {
    await topic.selectOption("frage");
    await topic.selectOption("melden");
    await expect(page.getByRole("note")).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  return {
    topic,
    name: page.getByRole("textbox", { name: /^Name/ }),
    email: page.getByRole("textbox", { name: "E-Mail" }),
    message: page.getByRole("textbox", { name: "Deine Nachricht" }),
    send: page.getByRole("button", { name: "Nachricht senden" }),
    problem: page.getByRole("alert").filter({ hasText: /\S/ }),
  };
}

test.describe("Kontaktformular", () => {
  test("unvollständige Angaben werden benannt, und nichts geht an den Server", async ({ page }) => {
    const form = await openForm(page);
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/api/contact")) requests.push(r.method());
    });

    await form.email.fill("keine-adresse");
    await form.message.fill("Das ist lang genug, die Adresse aber nicht.");
    await form.send.click();
    await expect(form.problem).toContainText("gültige E-Mail-Adresse");

    await form.email.fill("anna@example.test");
    await form.message.fill("kurz");
    await form.send.click();
    await expect(form.problem).toContainText("mindestens 10");
    expect(requests).toEqual([]);
  });

  test("eine Meldung kommt an: eine Mail an den Betreiber, eine Bestätigung an den Absender", async ({ page }) => {
    const form = await openForm(page);
    const email = `e2e-kontakt-${randomUUID().slice(0, 8)}@example.test`;
    const message = "Unter /geteilt/beispiel steht ein Inhalt, den ich melden möchte.";

    await form.name.fill("Anna Beispiel");
    await form.email.fill(email);
    await form.topic.selectOption("melden");
    await form.message.fill(message);
    await form.send.click();

    await expect(page.getByRole("status").filter({ hasText: "Angekommen, danke." })).toContainText(email);

    const report = mails().filter((mail) => mail.reply_to === email);
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({ to: [LEGAL.email], subject: "Kontakt: Rechtswidrigen Inhalt melden" });
    expect(report[0].text).toContain(message);
    expect(report[0].text).toContain(`Anna Beispiel <${email}>`);
    const confirmation = mails().filter((mail) => mail.to.includes(email));
    expect(confirmation).toHaveLength(1);
    expect(confirmation[0].subject).toBe("Deine Meldung ist angekommen");
    expect(confirmation[0].text).not.toContain(message);
  });

  test("nimmt Resend die Mail nicht an, sagt das Formular es und nennt die Adresse", async ({ page }) => {
    const form = await openForm(page);
    const message = `${RESEND_FAIL_MARKER}: diese Nachricht lehnt der Versand ab.`;

    await form.email.fill("anna@example.test");
    await form.topic.selectOption("idee");
    await form.message.fill(message);
    await form.send.click();

    await expect(form.problem).toContainText("konnte nicht gesendet werden");
    await expect(form.problem).toContainText(LEGAL.email);
    await expect(page.getByText("Angekommen, danke.")).toHaveCount(0);
    // Die Nachricht bleibt im Feld, damit sie nicht verloren ist.
    await expect(form.message).toHaveValue(message);
  });
});
