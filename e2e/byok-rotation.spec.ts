import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { test, expect, adminClient, createAccount, removeAccount, type Account } from "./support/fixtures";
import { localSupabase } from "./support/env";
import { decryptWith, encryptWith, run } from "../scripts/rotate-byok-secret.mjs";

// Die Probe der Umschlüsselung gegen den lokalen Stack: echte Tabelle, echte Prüfregeln, echtes PostgREST, dasselbe Skript
// wie gegen die Produktion. Die Zeilen liegen im alten Format in der Tabelle, so wie die App sie bis zur Umstellung
// geschrieben hat. Die Fake-Datenbank in tests/guards/rotate-byok-secret.test.ts deckt die Einzelfälle ab; hier zählt,
// dass Filter, Spaltenrechte und Schreibweg wirklich tragen. Die Secrets gelten nur für diesen Lauf.

const newSecret = () => randomBytes(32).toString("base64");

/** Das alte Format, eingefroren: base64(iv + tag + chiffretext), scrypt mit festem Salz, keine Bindung an die Zeile. */
function legacyBlob(secret: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", scryptSync(secret, "promptprinter-byok", 32), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

async function insertKey(account: Account, provider: string, encryptedKey: string) {
  const { error } = await adminClient()
    .from("user_api_keys")
    .insert({ user_id: account.id, provider, encrypted_key: encryptedKey, is_active: provider === "anthropic" });
  if (error) throw new Error(`E2E: Key konnte nicht angelegt werden: ${error.message}`);
}

async function rowsOf(account: Account) {
  const { data, error } = await adminClient()
    .from("user_api_keys")
    .select("id, user_id, provider, encrypted_key")
    .eq("user_id", account.id)
    .order("provider");
  if (error) throw new Error(`E2E: ${error.message}`);
  return data ?? [];
}

test.describe("Umschlüsseln der BYOK-Keys", () => {
  let first: Account;
  let second: Account;

  test.beforeEach(async () => {
    first = await createAccount("byok-a");
    second = await createAccount("byok-b");
  });
  test.afterEach(async () => {
    await removeAccount(first.id);
    await removeAccount(second.id);
  });

  function script(current: string, previous = "") {
    const { url, serviceRoleKey } = localSupabase();
    const out: string[] = [];
    return {
      out,
      options: { base: url, serviceKey: serviceRoleKey, current, previous, log: (l: string) => out.push(l), logError: (l: string) => out.push(l) },
    };
  }

  test("Formatwechsel ohne neues Secret: nichts geht verloren, jede Zeile ist danach gebunden", async () => {
    const secret = newSecret();
    await insertKey(first, "anthropic", legacyBlob(secret, "sk-ant-erster"));
    await insertKey(first, "openai", legacyBlob(secret, "sk-openai-erster"));
    await insertKey(second, "anthropic", legacyBlob(secret, "sk-ant-zweiter"));

    // Probelauf: zählt und schreibt nichts.
    const before = await rowsOf(first);
    const dry = script(secret);
    expect(await run({ ...dry.options, apply: false })).toBe(1);
    expect(dry.out.join("\n")).toContain("offen:              3");
    expect(await rowsOf(first)).toEqual(before);

    const apply = script(secret);
    expect(await run({ ...apply.options, apply: true })).toBe(0);
    expect(apply.out.join("\n")).toContain("umgeschlüsselt: 3");

    const [firstAnthropic, firstOpenai] = await rowsOf(first);
    const [secondAnthropic] = await rowsOf(second);
    expect(firstAnthropic.encrypted_key.startsWith("pp2.")).toBe(true);
    expect(decryptWith(secret, firstAnthropic.encrypted_key, firstAnthropic)).toBe("sk-ant-erster");
    expect(decryptWith(secret, firstOpenai.encrypted_key, firstOpenai)).toBe("sk-openai-erster");
    expect(decryptWith(secret, secondAnthropic.encrypted_key, secondAnthropic)).toBe("sk-ant-zweiter");

    // Ein zweiter Lauf hat nichts mehr zu tun.
    const again = script(secret);
    expect(await run({ ...again.options, apply: false })).toBe(0);
    expect(again.out.join("\n")).toContain("offen:              0");

    // Getauschte Chiffretexte öffnet danach nichts mehr, und das Skript schreibt nicht darüber.
    const admin = adminClient();
    await admin.from("user_api_keys").update({ encrypted_key: secondAnthropic.encrypted_key }).eq("id", firstAnthropic.id);
    await admin.from("user_api_keys").update({ encrypted_key: firstAnthropic.encrypted_key }).eq("id", secondAnthropic.id);
    const swapped = script(secret);
    expect(await run({ ...swapped.options, apply: true })).toBe(3);
    expect(swapped.out.join("\n")).toContain("von keinem lesbar:  2");
    const [stillSwapped] = await rowsOf(first);
    expect(stillSwapped.encrypted_key).toBe(secondAnthropic.encrypted_key);
  });

  test("Rotation: altes Format und altes Secret, danach öffnet nur noch das neue", async () => {
    const [oldSecret, newOne] = [newSecret(), newSecret()];
    await insertKey(first, "anthropic", legacyBlob(oldSecret, "sk-ant-alt"));
    await insertKey(second, "anthropic", encryptWith(oldSecret, "sk-ant-neu", { user_id: second.id, provider: "anthropic" }));

    const apply = script(newOne, oldSecret);
    expect(await run({ ...apply.options, apply: true })).toBe(0);

    const [firstRow] = await rowsOf(first);
    const [secondRow] = await rowsOf(second);
    expect(decryptWith(newOne, firstRow.encrypted_key, firstRow)).toBe("sk-ant-alt");
    expect(decryptWith(newOne, secondRow.encrypted_key, secondRow)).toBe("sk-ant-neu");
    expect(decryptWith(oldSecret, firstRow.encrypted_key, firstRow)).toBeNull();
    expect(decryptWith(oldSecret, secondRow.encrypted_key, secondRow)).toBeNull();

    const check = script(newOne);
    expect(await run({ ...check.options, apply: false })).toBe(0);
  });
});
