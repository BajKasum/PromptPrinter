import { test, expect, adminClient } from "./support/fixtures";
import { E2E_ORIGIN } from "./support/env";
import { FILE_MARKER, MISSING_REPO_URL, OPENAI_KEY, REPO } from "./support/fakes.cjs";
import { outboundRequests } from "./support/outbound";

// Das Projekt-Gedächtnis gegen den lokalen Stack: eine hochgeladene Datei und ein GitHub-Repo, analysiert mit dem
// eigenen Key des Kontos. GitHub und OpenAI sind die Stellvertreter (support/fakes.cjs): ihre Antwort nennt nur dann
// den Stand des Repos und der Datei, wenn beides beim "Modell" ankam.

test.describe("Projekt-Gedächtnis", () => {
  test("Repo und Datei analysieren, Fehler beim unbekannten Repo, Stand bleibt, löschen", async ({
    signedIn: { page, account },
  }) => {
    const admin = adminClient();
    // Gespeichert über dieselbe Route wie in den Einstellungen: sie prüft den Key beim Anbieter und verschlüsselt ihn.
    const saved = await page.request.post("/api/settings/api-key", {
      headers: { origin: E2E_ORIGIN },
      data: { apiKey: OPENAI_KEY },
    });
    expect(saved.status(), await saved.text()).toBe(200);

    const { data: project, error } = await admin
      .from("projects")
      .insert({ user_id: account.id, name: "Küchenhelfer", type: "software" })
      .select("id")
      .single();
    expect(error).toBeNull();
    const projectId = project!.id as string;
    const brainRow = async () =>
      (await admin.from("project_brains").select("*").eq("project_id", projectId).maybeSingle()).data;

    await page.goto(`/projects/${projectId}`);
    const card = page.getByRole("region", { name: "Projekt-Gedächtnis" });
    const repo = card.getByLabel("GitHub-Repository, optional");
    const analyze = card.getByRole("button", { name: "Projekt analysieren" });
    // Der Knopf wird erst durch den Zustand der Seite bedienbar: ein vor dem Hydratisieren gefülltes Feld zählt nicht.
    await expect(async () => {
      await repo.fill("");
      await repo.fill(MISSING_REPO_URL);
      await expect(analyze).toBeEnabled({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });

    // ── Ein Repo, das es nicht gibt ──────────────────────────────────────────
    await analyze.click();
    await expect(card.getByText("Das Repository konnte nicht gelesen werden.")).toBeVisible({ timeout: 30_000 });
    expect(await brainRow()).toMatchObject({ status: "failed", error_code: "repo_not_found" });

    // ── Datei hochladen, dann Repo und Datei zusammen analysieren ────────────
    await page.locator('input[type="file"]').setInputFiles({
      name: "kuechenplan.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(`# Küchenplan\n\n${FILE_MARKER}: montags wird eingekauft.\n`, "utf8"),
    });
    await expect(page.getByText("kuechenplan.md")).toBeVisible({ timeout: 30_000 });

    await repo.fill(REPO.url);
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/api/projects/${projectId}/brain`) && r.request().method() === "POST"),
      card.getByRole("button", { name: /Projekt analysieren|Neu analysieren/ }).click(),
    ]);
    expect(response.status(), await response.text()).toBe(200);

    const shows = async () => {
      await expect(card.getByText("Rezeptverwaltung aus dem Beispiel-Repo.")).toBeVisible({ timeout: 30_000 });
      await expect(card.getByRole("list", { name: "Stack" }).getByRole("listitem")).toHaveText(["Next.js", "React"]);
      await expect(card.getByRole("list", { name: "Eckdaten" })).toContainText("Küchenplan aus der hochgeladenen Datei");
      await expect(card.getByText(/2 Quellen/)).toBeVisible();
    };
    await shows();

    expect(await brainRow()).toMatchObject({
      status: "ready",
      user_id: account.id,
      repo_url: REPO.url,
      repo_ref: REPO.sha,
      error_code: null,
      sources: [
        { kind: "repo", name: `${REPO.owner}/${REPO.name}`, ref: REPO.sha },
        { kind: "file", name: "kuechenplan.md" },
      ],
    });
    // Der Import holte die Dateien vom Raw-Host, nicht über das Kontingent der API.
    expect(outboundRequests("raw.githubusercontent.com").map((r) => r.path)).toContain(
      `/${REPO.owner}/${REPO.name}/main/package.json`
    );

    // ── Nach dem Neuladen steht der Stand aus der Datenbank ──────────────────
    await page.reload();
    await shows();

    // ── Löschen ──────────────────────────────────────────────────────────────
    await expect(async () => {
      await card.getByRole("button", { name: "Gedächtnis löschen" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    await page.getByRole("dialog").getByRole("button", { name: "Gedächtnis löschen" }).click();
    await expect(card.getByText("Rezeptverwaltung aus dem Beispiel-Repo.")).toHaveCount(0);
    await expect.poll(brainRow).toBeNull();
  });
});
