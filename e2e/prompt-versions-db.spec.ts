import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ACCOUNT_CEILINGS } from "../src/shared/lib/plans";
import { localSupabase } from "./support/env";
import { adminClient, createAccount, expect, removeAccount, test, type Account } from "./support/fixtures";

// Versionen gespeicherter Prompts (Migration 0061) auf dem Weg, den jeder angemeldete Besucher aus der Browser-Konsole
// hat: PostgREST mit seinem JWT und dem öffentlichen anon-Key, also als `authenticated`. Die Oberfläche dazu kommt mit
// einem eigenen Spec; hier zählt, was die Datenbank selbst durchsetzt.

/** Der Client, den jeder angemeldete Besucher aus der Browser-Konsole bauen kann. */
async function asUser(account: Account): Promise<SupabaseClient> {
  const { url, anonKey } = localSupabase();
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw new Error(`E2E: Anmelden fehlgeschlagen: ${error.message}`);
  return client;
}

async function savePrompt(
  client: SupabaseClient,
  account: Account,
  outputs: Record<string, unknown>,
  extra: Record<string, unknown> = {}
): Promise<string> {
  const { data, error } = await client
    .from("saved_prompts")
    .insert({ user_id: account.id, outputs, ...extra })
    .select("id")
    .single();
  if (error || !data) throw new Error(`E2E: Prompt speichern: ${error?.message}`);
  return data.id as string;
}

async function createChat(client: SupabaseClient, account: Account, extra: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await client
    .from("conversations")
    .insert({ user_id: account.id, title: "Chat", ...extra })
    .select("id")
    .single();
  if (error || !data) throw new Error(`E2E: Chat anlegen: ${error?.message}`);
  return data.id as string;
}

/** Die Versionen eines Prompts, wie der Eigentümer sie liest. */
async function versionsOf(client: SupabaseClient, promptId: string): Promise<{ version: number; content: string }[]> {
  const { data, error } = await client
    .from("saved_prompt_versions")
    .select("version, content")
    .eq("prompt_id", promptId)
    .order("version");
  expect(error).toBeNull();
  return data ?? [];
}

async function countVersions(userId: string): Promise<number> {
  const { count, error } = await adminClient()
    .from("saved_prompt_versions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  expect(error).toBeNull();
  return count ?? -1;
}

test.describe("Versionen entstehen in der Datenbank", () => {
  test("Einfügen, Text ändern und Wiederherstellen legen eine an, Umbenennen nicht", async ({ account }) => {
    const client = await asUser(account);
    const id = await savePrompt(client, account, { prompt: "Erste Fassung", title: "Brief" });
    expect(await versionsOf(client, id)).toEqual([{ version: 1, content: "Erste Fassung" }]);

    const change = (outputs: Record<string, unknown>) => client.from("saved_prompts").update({ outputs }).eq("id", id);

    expect((await change({ prompt: "Zweite Fassung", title: "Brief" })).error).toBeNull();
    expect((await change({ prompt: "Zweite Fassung", title: "Brief an Anna" })).error).toBeNull();
    expect((await change({ prompt: "Zweite Fassung", title: "Brief an Anna" })).error).toBeNull();
    expect(await versionsOf(client, id)).toEqual([
      { version: 1, content: "Erste Fassung" },
      { version: 2, content: "Zweite Fassung" },
    ]);

    // Wiederherstellen ist ein Update mit dem alten Text: die alte Fassung wird die neueste, nichts geht verloren.
    expect((await change({ prompt: "Erste Fassung", title: "Brief an Anna" })).error).toBeNull();
    expect(await versionsOf(client, id)).toEqual([
      { version: 1, content: "Erste Fassung" },
      { version: 2, content: "Zweite Fassung" },
      { version: 3, content: "Erste Fassung" },
    ]);

    // Die aktuelle Fassung bleibt in saved_prompts, wie sie CLI, Teilen und Export lesen.
    const { data } = await client.from("saved_prompts").select("outputs").eq("id", id).single();
    expect(data?.outputs).toEqual({ prompt: "Erste Fassung", title: "Brief an Anna" });
  });

  test("ein Befehl mit mehreren Prompts zählt je Prompt weiter", async ({ account }) => {
    const client = await asUser(account);
    const a = await savePrompt(client, account, { prompt: "A", title: "A" });
    const b = await savePrompt(client, account, { prompt: "B", title: "B" });
    expect((await client.from("saved_prompts").update({ outputs: { prompt: "B", title: "B" } }).eq("id", a)).error).toBeNull();
    expect((await client.from("saved_prompts").update({ outputs: { prompt: "Neu", title: "X" } }).in("id", [a, b])).error).toBeNull();

    expect(await versionsOf(client, a)).toEqual([
      { version: 1, content: "A" },
      { version: 2, content: "B" },
      { version: 3, content: "Neu" },
    ]);
    expect(await versionsOf(client, b)).toEqual([
      { version: 1, content: "B" },
      { version: 2, content: "Neu" },
    ]);
  });
});

test.describe("Rechte am Verlauf", () => {
  test("ein fremdes Konto liest keine Version, und niemand schreibt eine von Hand", async ({ account }) => {
    const other = await createAccount("fremd");
    try {
      const owner = await asUser(account);
      const stranger = await asUser(other);
      const id = await savePrompt(owner, account, { prompt: "Geheim", title: "T" });

      const { data: seen, error: readError } = await stranger.from("saved_prompt_versions").select("id").eq("prompt_id", id);
      expect(readError).toBeNull();
      expect(seen).toEqual([]);

      const forged = { prompt_id: id, user_id: account.id, version: 99, content: "Gefälscht" };
      const attempts = [
        await owner.from("saved_prompt_versions").insert(forged),
        await owner.from("saved_prompt_versions").update({ content: "Anders" }).eq("prompt_id", id),
        await owner.from("saved_prompt_versions").delete().eq("prompt_id", id),
        // Auch der Server schreibt keine Version selbst, nur der Trigger.
        await adminClient().from("saved_prompt_versions").insert(forged),
        await adminClient().from("saved_prompt_versions").delete().eq("prompt_id", id),
      ];
      for (const result of attempts) {
        expect(result.error?.code, JSON.stringify(result.error)).toBe("42501");
      }

      const { url, anonKey } = localSupabase();
      const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      expect((await anon.from("saved_prompt_versions").select("id")).error?.code).toBe("42501");

      expect(await versionsOf(owner, id)).toEqual([{ version: 1, content: "Geheim" }]);
      // Lesen darf der Server (Export des Kontos).
      expect(await countVersions(account.id)).toBe(1);
    } finally {
      await removeAccount(other.id);
    }
  });

  test("Chat am Prompt und Ursprung am Chat nur aus dem eigenen Konto", async ({ account }) => {
    const victim = await createAccount("opfer");
    try {
      const attacker = await asUser(account);
      const owner = await asUser(victim);
      const victimChat = await createChat(owner, victim);
      const victimPrompt = await savePrompt(owner, victim, { prompt: "Fremd", title: "F" });
      const ownChat = await createChat(attacker, account);
      const ownPrompt = await savePrompt(attacker, account, { prompt: "Eigen", title: "E" });

      const refused = [
        await attacker.from("saved_prompts").insert({ user_id: account.id, outputs: { prompt: "x" }, conversation_id: victimChat }),
        await attacker.from("saved_prompts").update({ conversation_id: victimChat }).eq("id", ownPrompt),
        await attacker.from("conversations").insert({ user_id: account.id, title: "Q", source_prompt_id: victimPrompt }),
        await attacker.from("conversations").update({ source_prompt_id: victimPrompt }).eq("id", ownChat),
      ];
      for (const result of refused) {
        expect(result.error?.code, JSON.stringify(result.error)).toBe("42501");
      }

      // Die eigenen Wege bleiben offen.
      const fromChat = await savePrompt(attacker, account, { prompt: "Aus dem Chat", title: "C" }, { conversation_id: ownChat });
      const fromPrompt = await createChat(attacker, account, { source_prompt_id: ownPrompt });
      expect(
        (await attacker.from("saved_prompts").update({ outputs: { prompt: "Aus dem Chat 2", title: "C" } }).eq("id", fromChat)).error
      ).toBeNull();
      const { data } = await attacker.from("conversations").select("source_prompt_id").eq("id", fromPrompt).single();
      expect(data?.source_prompt_id).toBe(ownPrompt);
    } finally {
      await removeAccount(victim.id);
    }
  });
});

test.describe("Löschen", () => {
  test("die Versionen gehen mit dem Prompt, die Verweise werden leer, der Chat behält seinen Platz", async ({ account }) => {
    const client = await asUser(account);
    const chat = await createChat(client, account);
    const prompt = await savePrompt(client, account, { prompt: "v1", title: "T" }, { conversation_id: chat });
    expect((await client.from("saved_prompts").update({ outputs: { prompt: "v2", title: "T" } }).eq("id", prompt)).error).toBeNull();
    const started = await createChat(client, account, { source_prompt_id: prompt });
    const { data: before } = await client.from("conversations").select("updated_at").eq("id", started).single();
    expect(await countVersions(account.id)).toBe(2);

    expect((await client.from("saved_prompts").delete().eq("id", prompt)).error).toBeNull();
    expect(await countVersions(account.id)).toBe(0);
    const { data: after } = await client.from("conversations").select("source_prompt_id, updated_at").eq("id", started).single();
    expect(after?.source_prompt_id).toBeNull();
    expect(after?.updated_at).toBe(before?.updated_at);

    // Ein gelöschter Chat leert den Verweis am Prompt, der Prompt bleibt.
    const kept = await savePrompt(client, account, { prompt: "bleibt", title: "T" }, { conversation_id: chat });
    expect((await client.from("conversations").delete().eq("id", chat)).error).toBeNull();
    const { data: orphan } = await client.from("saved_prompts").select("conversation_id").eq("id", kept).single();
    expect(orphan?.conversation_id).toBeNull();
  });

  test("Konto löschen nimmt die Versionen mit", async () => {
    const gone = await createAccount("weg");
    const client = await asUser(gone);
    await savePrompt(client, gone, { prompt: "eins", title: "T" });
    expect(await countVersions(gone.id)).toBe(1);
    await removeAccount(gone.id);
    expect(await countVersions(gone.id)).toBe(0);
  });
});

test.describe("Grenze je Konto", () => {
  test.setTimeout(240_000);

  test("Zeilen: an der Grenze scheitert jede Textänderung ganz, Umbenennen geht weiter", async ({ account }) => {
    const client = await asUser(account);
    const admin = adminClient();
    const { rows } = ACCOUNT_CEILINGS.savedPromptVersions;
    const prompts = ACCOUNT_CEILINGS.savedPrompts.rows;
    expect(rows % prompts).toBe(0);

    // Je Befehl eine Version für jeden Prompt: so viele Runden, bis die Grenze genau erreicht ist.
    const seeded = await admin
      .from("saved_prompts")
      .insert(Array.from({ length: prompts }, () => ({ user_id: account.id, outputs: { prompt: "v1", title: "T" } })));
    expect(seeded.error).toBeNull();
    for (let round = 2; round <= rows / prompts; round += 1) {
      const { error } = await admin
        .from("saved_prompts")
        .update({ outputs: { prompt: `v${round}`, title: "T" } })
        .eq("user_id", account.id);
      expect(error, `Runde ${round}`).toBeNull();
    }
    expect(await countVersions(account.id)).toBe(rows);

    const { data: one } = await client.from("saved_prompts").select("id, outputs").limit(1).single();
    const current = one?.outputs as { prompt: string; title: string };
    const refused = await client.from("saved_prompts").update({ outputs: { ...current, prompt: "zu viel" } }).eq("id", one?.id);
    expect(refused.error?.message).toContain("Obergrenze");
    expect(refused.error?.message).toContain("saved_prompt_versions");

    const { data: unchanged } = await client.from("saved_prompts").select("outputs").eq("id", one?.id).single();
    expect(unchanged?.outputs).toEqual(current);
    expect((await client.from("saved_prompts").update({ outputs: { ...current, title: "Neu" } }).eq("id", one?.id)).error).toBeNull();
  });

  test("Bytes: weit vor der Zeilengrenze", async ({ account }) => {
    const client = await asUser(account);
    const admin = adminClient();
    // Zufall lässt sich kaum komprimieren; 150 000 Zeichen je Fassung, 100 Prompts liegen unter der Grenze der Prompts,
    // zwei Runden (30 MB) unter der Grenze der Versionen, drei (45 MB) darüber.
    const text = () => randomBytes(112_500).toString("base64");
    for (let i = 0; i < 10; i += 1) {
      const { error } = await admin
        .from("saved_prompts")
        .insert(Array.from({ length: 10 }, () => ({ user_id: account.id, outputs: { prompt: text() } })));
      expect(error).toBeNull();
    }
    expect((await admin.from("saved_prompts").update({ outputs: { prompt: text() } }).eq("user_id", account.id)).error).toBeNull();

    // Die dritte Runde reisst die Grenze und wird ganz zurückgerollt.
    const third = await admin.from("saved_prompts").update({ outputs: { prompt: text() } }).eq("user_id", account.id);
    expect(third.error?.message).toContain("Obergrenze");
    expect(await countVersions(account.id)).toBe(200);

    // Bis zur Grenze ist noch Platz: der Nutzer füllt ihn Fassung für Fassung.
    const { data: one } = await client.from("saved_prompts").select("id").limit(1).single();
    let refusal: string | undefined;
    let accepted = 0;
    for (let i = 0; i < 120 && !refusal; i += 1) {
      const { error } = await client.from("saved_prompts").update({ outputs: { prompt: text() } }).eq("id", one?.id);
      if (error) refusal = error.message;
      else accepted += 1;
    }
    expect(refusal).toContain("Obergrenze");
    expect(accepted).toBeGreaterThan(0);
    expect(200 + accepted).toBeLessThan(ACCOUNT_CEILINGS.savedPromptVersions.rows);
  });
});
