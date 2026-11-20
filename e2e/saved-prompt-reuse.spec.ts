import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { test, expect, adminClient, createAccount, removeAccount, type Account } from "./support/fixtures";
import { E2E_ORIGIN } from "./support/env";
import {
  exportCode,
  exportJson,
  exportPromptFile,
  type ExportCode,
  type ExportTarget,
  type PromptExportInput,
} from "../src/shared/lib/prompt-export";

// Wiederverwenden eines gespeicherten Prompts gegen den lokalen Stack: Platzhalter ausfüllen auf /prompts und auf
// einem geteilten Link, "Als Ausgangspunkt nutzen" im globalen und im Projekt-Chat (die echte Sitzung und RLS lesen
// den Prompt, eine fremde ID ergibt einen leeren Chat), jeder Export in der Vorschau und die Datei als Download.

const PROMPT = "Du schreibst kurze, höfliche Briefe.\n\nSchreib an [Name des Vermieters] wegen [Thema].";
const TITLE = "Brief an den Vermieter";
const START = `Pass diesen Prompt an: \n\n${PROMPT}`;

async function savePrompt(account: Account, projectId: string | null = null): Promise<string> {
  const { data, error } = await adminClient()
    .from("saved_prompts")
    .insert({ user_id: account.id, project_id: projectId, outputs: { title: TITLE, prompt: PROMPT } })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data!.id as string;
}

async function openCard(page: Page) {
  await page.getByRole("button", { name: TITLE }).click();
}

test.describe("Gespeicherten Prompt wiederverwenden", () => {
  test("Platzhalter ausfüllen und jeder Export auf /prompts", async ({ signedIn: { page, account } }) => {
    await savePrompt(account);
    await page.goto("/prompts");
    await openCard(page);

    await page.getByRole("button", { name: "Platzhalter ausfüllen (2)" }).click();
    await page.getByLabel("Name des Vermieters").fill("Frau Muster");
    await expect(page.locator("pre", { hasText: "Schreib an Frau Muster wegen [Thema]." })).toBeVisible();

    await page.getByRole("button", { name: "Für Entwickler exportieren" }).click();
    const fill = { values: { "name des vermieters": "Frau Muster" }, skipped: new Set<string>() };
    const preview = page.getByLabel("Vorschau des Exports");
    // Wörtlich, ohne die Leerraum-Normalisierung von toHaveText: Einrückung und Zeilen zählen.
    const shows = (text: string) => expect.poll(() => preview.textContent()).toBe(text);
    const pick = (group: string, name: string) =>
      page.getByRole("group", { name: group }).getByRole("button", { name, exact: true }).click();
    const targets: [ExportTarget, string][] = [
      ["openai", "OpenAI-kompatibel"],
      ["anthropic", "Anthropic"],
      ["gemini", "Gemini"],
    ];
    const codes: [ExportCode, string][] = [
      ["curl", "curl"],
      ["python", "Python"],
      ["javascript", "JavaScript"],
    ];

    for (const split of [false, true]) {
      const input: PromptExportInput = { prompt: PROMPT, title: TITLE, fill, systemFromFirstParagraph: split };
      if (split) await page.getByLabel("Ersten Absatz als Systemnachricht").check();
      for (const [target, targetLabel] of targets) {
        await pick("Format", "JSON");
        await pick("Schnittstelle", targetLabel);
        await shows(exportJson(target, input));
        for (const [code, codeLabel] of codes) {
          await pick("Format", codeLabel);
          await shows(exportCode(target, code, input));
        }
      }
      await pick("Format", ".prompt.md");
      const file = exportPromptFile(input);
      await shows(file);
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Herunterladen" }).click(),
      ]);
      expect(download.suggestedFilename()).toBe("brief-an-den-vermieter.prompt.md");
      expect(await readFile((await download.path())!, "utf8")).toBe(file);
    }
  });

  test("Als Ausgangspunkt im globalen Chat: nur ins Eingabefeld, nichts gesendet", async ({ signedIn: { page, account } }) => {
    const id = await savePrompt(account);
    await page.goto("/prompts");
    await openCard(page);
    await page.getByRole("link", { name: `Neuen Chat mit „${TITLE}“ als Ausgangspunkt beginnen` }).click();

    await expect(page).toHaveURL(`${E2E_ORIGIN}/chats/new?from=${id}`);
    const composer = page.getByLabel("Nachricht an Finn");
    await expect(composer).toHaveValue(START);
    await expect(composer).toBeFocused();
    expect(await composer.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe("Pass diesen Prompt an: ".length);
    // Nichts gesendet: kein Chat angelegt, keine Antwort.
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(`${E2E_ORIGIN}/chats/new?from=${id}`);
    const { count } = await adminClient().from("conversations").select("id", { count: "exact", head: true }).eq("user_id", account.id);
    expect(count).toBe(0);
  });

  test("Als Ausgangspunkt im Projekt-Chat, dann gesendet", async ({ signedIn: { page, account } }) => {
    const admin = adminClient();
    const { data: project, error } = await admin.from("projects").insert({ user_id: account.id, name: "Wohnung" }).select("id").single();
    expect(error).toBeNull();
    const projectId = project!.id as string;
    const id = await savePrompt(account, projectId);

    await page.goto(`/projects/${projectId}/results`);
    await openCard(page);
    await page.getByRole("link", { name: /als Ausgangspunkt beginnen/ }).click();
    await expect(page).toHaveURL(`${E2E_ORIGIN}/projects/${projectId}/chats/new?from=${id}`);
    const composer = page.getByLabel("Nachricht an Finn");
    await expect(composer).toHaveValue(START);

    await composer.press("End");
    await composer.pressSequentially("kürzer");
    await page.getByRole("button", { name: "Senden" }).click();
    await expect(page.getByText("Demo-Antwort")).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/chats/[0-9a-f-]{36}$`));
    const { data: messages } = await admin
      .from("messages")
      .select("role, content")
      .eq("user_id", account.id)
      .eq("role", "user");
    expect(messages?.[0]?.content).toBe(`Pass diesen Prompt an: kürzer\n\n${PROMPT}`);
  });

  test("eine fremde oder unsinnige ID startet einen leeren Chat", async ({ signedIn: { page } }) => {
    const other = await createAccount("vorlage-fremd");
    try {
      const foreignId = await savePrompt(other);
      for (const from of [foreignId, "abc", "00000000-0000-4000-8000-000000000000"]) {
        const res = await page.goto(`/chats/new?from=${from}`);
        expect(res?.status()).toBe(200);
        await expect(page.getByLabel("Nachricht an Finn")).toHaveValue("");
      }
      await expect(page.getByText("Schreib an [Name des Vermieters]")).toHaveCount(0);
    } finally {
      await removeAccount(other.id);
    }
  });

  test("Platzhalter ausfüllen auf einem geteilten Link", async ({ signedIn: { page, account }, browser }) => {
    const id = await savePrompt(account);
    const shared = await page.request.post(`/api/prompts/${id}/share`, { headers: { origin: E2E_ORIGIN } });
    expect(shared.status(), await shared.text()).toBe(200);
    const { token } = (await shared.json()) as { token: string };

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/geteilt/${token}`);
    await visitor.getByRole("button", { name: "Platzhalter ausfüllen (2)" }).click();
    await expect(visitor.getByText("Was du einträgst, bleibt in diesem Browser und geht an niemanden.")).toBeVisible();
    await visitor.getByLabel("Thema").fill("Heizung");
    await expect(visitor.locator("pre", { hasText: "Schreib an [Name des Vermieters] wegen Heizung." })).toBeVisible();
  });
});
