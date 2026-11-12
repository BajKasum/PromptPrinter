import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ACCOUNT_CEILINGS, PLAN_LIMITS } from "../src/shared/lib/plans";
import { localSupabase } from "./support/env";
import { adminClient, createAccount, expect, makePro, removeAccount, test, type Account } from "./support/fixtures";

// Die Grenzen je Konto und die Eigentümer-Prüfung, auf dem Weg, den die Routen nicht sehen: PostgREST und Storage
// mit dem JWT eines Nutzers und dem öffentlichen anon-Key, also als `authenticated`. Auffüllen darf der Admin-Client,
// für ihn gelten dieselben Trigger, die Zählung läuft aber nur einmal je Befehl.

const MIB = 1024 * 1024;

/** Der Client, den jeder angemeldete Besucher aus der Browser-Konsole bauen kann. */
async function asUser(account: Account): Promise<SupabaseClient> {
  const { url, anonKey } = localSupabase();
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw new Error(`E2E: Anmelden fehlgeschlagen: ${error.message}`);
  return client;
}

/** Fügt `total` Zeilen in Blöcken ein, ein Fehler bricht den Test ab. */
async function seed(table: string, total: number, row: (i: number) => Record<string, unknown>): Promise<void> {
  const admin = adminClient();
  for (let start = 0; start < total; start += 5000) {
    const rows = Array.from({ length: Math.min(5000, total - start) }, (_, i) => row(start + i));
    const { error } = await admin.from(table).insert(rows);
    if (error) throw new Error(`E2E: ${table} auffüllen: ${error.message}`);
  }
}

async function createProject(client: SupabaseClient, account: Account, name: string): Promise<string> {
  const { data, error } = await client.from("projects").insert({ user_id: account.id, name }).select("id").single();
  if (error || !data) throw new Error(`E2E: Projekt anlegen: ${error?.message}`);
  return data.id as string;
}

async function createChat(client: SupabaseClient, account: Account, projectId: string | null = null): Promise<string> {
  const { data, error } = await client
    .from("conversations")
    .insert({ user_id: account.id, title: "Chat", project_id: projectId })
    .select("id")
    .single();
  if (error || !data) throw new Error(`E2E: Chat anlegen: ${error?.message}`);
  return data.id as string;
}

/** Wiederholt das Einfügen, bis die Datenbank ablehnt, und gibt die Meldung zurück. */
async function untilRefused(
  attempts: number,
  insert: () => PromiseLike<{ error: { message: string } | null }>
): Promise<string | undefined> {
  for (let i = 0; i <= attempts; i += 1) {
    const { error } = await insert();
    if (error) return error.message;
  }
  return undefined;
}

/** Objekte kaskadieren nicht mit dem Konto, sie gehen vorher über die Storage-API. */
async function removeObjects(account: Account, projectIds: string[]): Promise<void> {
  const bucket = adminClient().storage.from("project-files");
  for (const projectId of projectIds) {
    const { data } = await bucket.list(`${account.id}/${projectId}`, { limit: 1000 });
    if (data?.length) await bucket.remove(data.map((f) => `${account.id}/${projectId}/${f.name}`));
  }
}

test.describe("Projekt-Grenze des Plans", () => {
  test("zehn parallele Einfügungen ergeben höchstens die Grenze", async ({ account }) => {
    const client = await asUser(account);
    const cap = PLAN_LIMITS.free.projects;

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => client.from("projects").insert({ user_id: account.id, name: `P${i}` }))
    );

    expect(results.filter((r) => !r.error)).toHaveLength(cap);
    for (const refused of results.filter((r) => r.error)) {
      expect(refused.error?.message).toContain("Projekt-Limit");
    }
    const { count } = await adminClient()
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", account.id);
    expect(count).toBe(cap);
  });

  test("ein Befehl mit vielen Zeilen kommt nicht durch, und Pro hat keine Grenze", async ({ account }) => {
    const client = await asUser(account);
    const tooMany = Array.from({ length: PLAN_LIMITS.free.projects + 1 }, (_, i) => ({
      user_id: account.id,
      name: `P${i}`,
    }));

    expect((await client.from("projects").insert(tooMany)).error?.message).toContain("Projekt-Limit");

    await makePro(account);
    expect((await client.from("projects").insert(tooMany)).error).toBeNull();
  });

  test("ein Konto über der Grenze behält alles und kann nur nicht neu anlegen", async ({ account }) => {
    const client = await asUser(account);
    await makePro(account);
    const ids = await Promise.all(
      Array.from({ length: PLAN_LIMITS.free.projects + 2 }, (_, i) => createProject(client, account, `P${i}`))
    );
    const { error: downgrade } = await adminClient().from("profiles").update({ plan: "free" }).eq("id", account.id);
    expect(downgrade).toBeNull();

    expect((await client.from("projects").update({ name: "Neu" }).eq("id", ids[0])).error).toBeNull();
    expect((await client.from("projects").select("id")).data).toHaveLength(ids.length);
    expect((await client.from("projects").insert({ user_id: account.id, name: "X" })).error?.message).toContain(
      "Projekt-Limit"
    );

    // Unter der Grenze geht es wieder.
    for (const id of ids.slice(0, 3)) {
      expect((await client.from("projects").delete().eq("id", id)).error).toBeNull();
    }
    expect((await client.from("projects").insert({ user_id: account.id, name: "X" })).error).toBeNull();
  });
});

test.describe("Eigentümer der Elternzeile", () => {
  test("eine eigene Zeile zeigt nie auf ein fremdes Projekt oder einen fremden Chat", async ({ account }) => {
    const victim = await createAccount("opfer");
    const attacker = await asUser(account);
    const owner = await asUser(victim);
    const victimProject = await createProject(owner, victim, "Fremd");
    const victimChat = await createChat(owner, victim, victimProject);
    const ownProject = await createProject(attacker, account, "Eigen");
    const ownChat = await createChat(attacker, account);

    // Ein echtes eigenes Objekt: sonst lehnte schon der Datei-Trigger ab, nicht die Policy.
    const path = `${account.id}/${ownProject}/notizen.md`;
    const upload = await attacker.storage.from("project-files").upload(path, "# Notizen", { contentType: "text/plain" });
    expect(upload.error).toBeNull();
    const fileRow = { user_id: account.id, name: "notizen.md", storage_path: path, size_bytes: 9 };

    try {
      const refused = [
        await attacker.from("conversations").insert({ user_id: account.id, title: "Q", project_id: victimProject }),
        await attacker.from("conversations").update({ project_id: victimProject }).eq("id", ownChat),
        await attacker
          .from("messages")
          .insert({ conversation_id: victimChat, user_id: account.id, role: "user", content: "Q" }),
        await attacker.from("project_files").insert({ ...fileRow, project_id: victimProject }),
      ];
      for (const result of refused) {
        expect(result.error?.code, JSON.stringify(result.error)).toBe("42501");
      }

      // Die eigenen Wege bleiben offen: Chat im Projekt, Chat verschieben, Nachricht, Datei.
      expect((await attacker.from("conversations").update({ project_id: ownProject }).eq("id", ownChat)).error).toBeNull();
      expect((await attacker.from("conversations").update({ project_id: null }).eq("id", ownChat)).error).toBeNull();
      await createChat(attacker, account, ownProject);
      expect(
        (await attacker.from("messages").insert({ conversation_id: ownChat, user_id: account.id, role: "user", content: "A" }))
          .error
      ).toBeNull();
      expect((await attacker.from("project_files").insert({ ...fileRow, project_id: ownProject })).error).toBeNull();

      const { count } = await adminClient()
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("project_id", victimProject);
      expect(count).toBe(1);
    } finally {
      await removeObjects(account, [ownProject]);
      await removeAccount(victim.id);
    }
  });
});

test.describe("Obergrenzen je Konto", () => {
  test.setTimeout(240_000);

  test("Chats: an der Grenze ist Schluss, Löschen macht wieder Platz", async ({ account }) => {
    const client = await asUser(account);
    await seed("conversations", ACCOUNT_CEILINGS.conversations.rows, () => ({ user_id: account.id, title: "S" }));

    const refused = await client.from("conversations").insert({ user_id: account.id, title: "Zuviel" });
    expect(refused.error?.message).toContain("Obergrenze");

    const { data } = await client.from("conversations").select("id").limit(1).single();
    expect((await client.from("conversations").delete().eq("id", data?.id)).error).toBeNull();
    expect((await client.from("conversations").insert({ user_id: account.id, title: "Passt" })).error).toBeNull();
  });

  test("Nachrichten: Zeilen", async ({ account }) => {
    const client = await asUser(account);
    const chat = await createChat(client, account);
    await seed("messages", ACCOUNT_CEILINGS.messages.rows, () => ({
      conversation_id: chat,
      user_id: account.id,
      role: "user",
      content: "S",
    }));

    const refused = await client
      .from("messages")
      .insert({ conversation_id: chat, user_id: account.id, role: "user", content: "Zuviel" });
    expect(refused.error?.message).toContain("Obergrenze");
  });

  test("Nachrichten: Bytes, weit vor der Zeilengrenze", async ({ account }) => {
    const client = await asUser(account);
    const chat = await createChat(client, account);
    // Zufall lässt sich kaum komprimieren, derselbe Text in vielen Zeilen zählt trotzdem je Zeile.
    const content = randomBytes(30_000).toString("base64");
    const admin = adminClient();

    let rows = 0;
    let refusal: string | undefined;
    while (!refusal && rows < 4000) {
      const batch = Array.from({ length: 100 }, () => ({
        conversation_id: chat,
        user_id: account.id,
        role: "user",
        content,
      }));
      const { error } = await admin.from("messages").insert(batch);
      if (error) refusal = error.message;
      else rows += batch.length;
    }

    expect(refusal).toContain("Obergrenze");
    expect(rows * content.length).toBeGreaterThan(0.9 * ACCOUNT_CEILINGS.messages.bytes);
    expect(rows).toBeLessThan(ACCOUNT_CEILINGS.messages.rows);

    // Der abgelehnte Block ist zurückgerollt, bis zur Grenze ist also noch Platz: der Nutzer füllt ihn Zeile für Zeile.
    const refused = await untilRefused(100, () =>
      client.from("messages").insert({ conversation_id: chat, user_id: account.id, role: "user", content })
    );
    expect(refused).toContain("Obergrenze");
  });

  test("gespeicherte Prompts: Zeilen und Bytes", async ({ account }) => {
    const client = await asUser(account);
    await seed("saved_prompts", ACCOUNT_CEILINGS.savedPrompts.rows, () => ({ user_id: account.id, outputs: {} }));

    const refused = await client.from("saved_prompts").insert({ user_id: account.id, outputs: {} });
    expect(refused.error?.message).toContain("Obergrenze");

    // Platz bei den Zeilen schaffen, dann bis an das Byte-Budget.
    expect((await adminClient().from("saved_prompts").delete().eq("user_id", account.id)).error).toBeNull();
    const text = randomBytes(140_000).toString("base64");
    let rows = 0;
    let refusal: string | undefined;
    while (!refusal && rows < 400) {
      const { error } = await adminClient()
        .from("saved_prompts")
        .insert(Array.from({ length: 10 }, () => ({ user_id: account.id, outputs: { text } })));
      if (error) refusal = error.message;
      else rows += 10;
    }
    expect(refusal).toContain("Obergrenze");
    expect(rows).toBeLessThan(ACCOUNT_CEILINGS.savedPrompts.rows);

    const refusedByUser = await untilRefused(10, () =>
      client.from("saved_prompts").insert({ user_id: account.id, outputs: { text } })
    );
    expect(refusedByUser).toContain("Obergrenze");
  });

  test("gespeicherte Prompts: auch ein Update zählt gegen die Bytes, unter der Grenze geht Ändern weiter", async ({ account }) => {
    const client = await asUser(account);
    // Kleine Zeilen liegen weit unter dem Budget; erst das Vergrössern Zeile für Zeile füllt es.
    await seed("saved_prompts", 200, () => ({ user_id: account.id, outputs: {} }));
    const { data: rows, error } = await client.from("saved_prompts").select("id").eq("user_id", account.id);
    expect(error).toBeNull();

    const text = randomBytes(140_000).toString("base64");
    let grown = 0;
    let refusal: string | undefined;
    for (const row of rows ?? []) {
      const res = await client.from("saved_prompts").update({ outputs: { text } }).eq("id", row.id);
      if (res.error) {
        refusal = res.error.message;
        break;
      }
      grown += 1;
    }
    expect(refusal).toContain("Obergrenze");
    expect(grown * text.length).toBeGreaterThan(0.9 * ACCOUNT_CEILINGS.savedPrompts.bytes);

    // Das abgelehnte Update ist zurückgerollt, das Konto liegt knapp unter der Grenze: Verkleinern geht.
    const shrunk = await client.from("saved_prompts").update({ outputs: {} }).eq("id", rows![0].id);
    expect(shrunk.error).toBeNull();
  });

  test("Dateizeilen", async ({ account }) => {
    const client = await asUser(account);
    await makePro(account);
    const perProject = 20;
    const projects: string[] = [];
    for (let i = 0; i <= ACCOUNT_CEILINGS.projectFiles.rows / perProject; i += 1) {
      projects.push(await createProject(client, account, `P${i}`));
    }

    // Alle Zeilen zeigen auf ein einziges kleines Objekt, nur die Zahl der Zeilen zählt hier.
    const path = `${account.id}/${projects[0]}/notizen.md`;
    const upload = await client.storage.from("project-files").upload(path, "# Notizen", { contentType: "text/plain" });
    expect(upload.error).toBeNull();
    const row = (projectId: string) => ({
      project_id: projectId,
      user_id: account.id,
      name: "notizen.md",
      storage_path: path,
      size_bytes: 9,
    });

    try {
      for (const projectId of projects.slice(0, -1)) {
        const { error } = await adminClient()
          .from("project_files")
          .insert(Array.from({ length: perProject }, () => row(projectId)));
        expect(error).toBeNull();
      }
      const refused = await client.from("project_files").insert(row(projects.at(-1)!));
      expect(refused.error?.message).toContain("Obergrenze");
    } finally {
      await removeObjects(account, [projects[0]]);
    }
  });

  test("Speicher: das Byte-Budget gilt auch für Objekte ohne Zeile", async ({ account }) => {
    const client = await asUser(account);
    const bucket = client.storage.from("project-files");
    const projects = await Promise.all(
      Array.from({ length: PLAN_LIMITS.free.projects }, (_, i) => createProject(client, account, `P${i}`))
    );
    const blob = randomBytes(2 * MIB);
    const fits = ACCOUNT_CEILINGS.projectFileStorage.bytes / blob.length;

    try {
      for (let i = 0; i < fits; i += 1) {
        const { error } = await bucket.upload(`${account.id}/${projects[i % projects.length]}/${i}.png`, blob, {
          contentType: "image/png",
        });
        expect(error, `Objekt ${i}`).toBeNull();
      }
      const { error } = await bucket.upload(`${account.id}/${projects[0]}/zuviel.png`, blob, {
        contentType: "image/png",
      });
      expect(error?.message).toMatch(/row-level security/i);
    } finally {
      await removeObjects(account, projects);
    }
  });
});
