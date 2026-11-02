import { spawnSync } from "node:child_process";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, scryptSync } from "node:crypto";
import { test, expect, adminClient, createAccount, removeAccount, type Account } from "./support/fixtures";
import { localSupabase } from "./support/env";

// Die Probe der Umschlüsselung gegen den lokalen Stack: echte Tabelle, echte Prüfregeln, echtes PostgREST und dasselbe
// Skript wie gegen die Produktion, als eigener Prozess. Die Zeilen liegen im alten Format in der Tabelle, so wie die App
// sie bis zur Umstellung geschrieben hat. Die Fake-Datenbank in tests/guards/rotate-byok-secret.test.ts deckt die
// Einzelfälle ab; hier zählt, dass Filter, Spaltenrechte und Schreibweg wirklich tragen. Die Secrets gelten nur für diesen
// Lauf. Das Format steht hier ein drittes Mal, von Hand: so prüft der Test, was wirklich in der Tabelle liegt.

const newSecret = () => randomBytes(32).toString("base64");

type Bound = { user_id: string; provider: string };

/** Das alte Format, eingefroren: base64(iv + tag + chiffretext), scrypt mit festem Salz, keine Bindung an die Zeile. */
function legacyBlob(secret: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", scryptSync(secret, "promptprinter-byok", 32), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

const hkdf = (secret: string, info: string, length: number) =>
  Buffer.from(hkdfSync("sha256", secret, Buffer.alloc(0), info, length));
const keyOf = (secret: string) => hkdf(secret, "promptprinter/byok/v2/aes-256-gcm", 32);
const kidOf = (secret: string) => hkdf(secret, "promptprinter/byok/v2/key-id", 4).toString("hex");
const aadOf = (row: Bound) => Buffer.from(`${row.user_id}|${row.provider}`, "utf8");

/** Das neue Format: `pp2.<kid>.<base64url(iv + tag + chiffretext)>`, gebunden an `user_id|provider`. */
function boundBlob(secret: string, plaintext: string, row: Bound): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyOf(secret), iv);
  cipher.setAAD(aadOf(row));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `pp2.${kidOf(secret)}.${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url")}`;
}

/** Öffnet einen Wert im neuen Format, null wenn Secret oder Zeile nicht passen. */
function openBound(secret: string, blob: string, row: Bound): string | null {
  const [prefix, kid, payload] = blob.split(".");
  if (prefix !== "pp2" || kid !== kidOf(secret)) return null;
  const raw = Buffer.from(payload, "base64url");
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyOf(secret), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    decipher.setAAD(aadOf(row));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Das Skript so aufgerufen, wie der Kopfkommentar es beschreibt. */
function runScript(current: string, previous: string, apply: boolean) {
  const { url, serviceRoleKey } = localSupabase();
  const result = spawnSync(process.execPath, ["scripts/rotate-byok-secret.mjs", ...(apply ? ["--apply"] : [])], {
    encoding: "utf8",
    env: {
      ...process.env,
      SUPABASE_URL: url,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      API_KEY_ENCRYPTION_SECRET: current,
      API_KEY_ENCRYPTION_SECRET_PREVIOUS: previous,
    },
  });
  return { code: result.status, out: `${result.stdout}\n${result.stderr}` };
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

  test("Formatwechsel ohne neues Secret: nichts geht verloren, jede Zeile ist danach gebunden", async () => {
    const secret = newSecret();
    await insertKey(first, "anthropic", legacyBlob(secret, "sk-ant-erster"));
    await insertKey(first, "openai", legacyBlob(secret, "sk-openai-erster"));
    await insertKey(second, "anthropic", legacyBlob(secret, "sk-ant-zweiter"));

    // Probelauf: zählt und schreibt nichts.
    const before = await rowsOf(first);
    const dry = runScript(secret, "", false);
    expect(dry.code, dry.out).toBe(1);
    expect(dry.out).toContain("offen:              3");
    expect(await rowsOf(first)).toEqual(before);

    const apply = runScript(secret, "", true);
    expect(apply.code, apply.out).toBe(0);
    expect(apply.out).toContain("umgeschlüsselt: 3");

    const [firstAnthropic, firstOpenai] = await rowsOf(first);
    const [secondAnthropic] = await rowsOf(second);
    expect(openBound(secret, firstAnthropic.encrypted_key, firstAnthropic)).toBe("sk-ant-erster");
    expect(openBound(secret, firstOpenai.encrypted_key, firstOpenai)).toBe("sk-openai-erster");
    expect(openBound(secret, secondAnthropic.encrypted_key, secondAnthropic)).toBe("sk-ant-zweiter");

    // Ein zweiter Lauf hat nichts mehr zu tun.
    const again = runScript(secret, "", false);
    expect(again.code, again.out).toBe(0);
    expect(again.out).toContain("offen:              0");

    // Getauschte Chiffretexte öffnet danach nichts mehr, und das Skript schreibt nicht darüber.
    const admin = adminClient();
    await admin.from("user_api_keys").update({ encrypted_key: secondAnthropic.encrypted_key }).eq("id", firstAnthropic.id);
    await admin.from("user_api_keys").update({ encrypted_key: firstAnthropic.encrypted_key }).eq("id", secondAnthropic.id);
    expect(openBound(secret, secondAnthropic.encrypted_key, firstAnthropic)).toBeNull();
    const swapped = runScript(secret, "", true);
    expect(swapped.code, swapped.out).toBe(3);
    expect(swapped.out).toContain("von keinem lesbar:  2");
    const [stillSwapped] = await rowsOf(first);
    expect(stillSwapped.encrypted_key).toBe(secondAnthropic.encrypted_key);
  });

  test("Rotation: altes Format und altes Secret, danach öffnet nur noch das neue", async () => {
    const [oldSecret, newOne] = [newSecret(), newSecret()];
    await insertKey(first, "anthropic", legacyBlob(oldSecret, "sk-ant-alt"));
    await insertKey(second, "anthropic", boundBlob(oldSecret, "sk-ant-neu", { user_id: second.id, provider: "anthropic" }));

    const apply = runScript(newOne, oldSecret, true);
    expect(apply.code, apply.out).toBe(0);

    const [firstRow] = await rowsOf(first);
    const [secondRow] = await rowsOf(second);
    expect(openBound(newOne, firstRow.encrypted_key, firstRow)).toBe("sk-ant-alt");
    expect(openBound(newOne, secondRow.encrypted_key, secondRow)).toBe("sk-ant-neu");
    expect(openBound(oldSecret, firstRow.encrypted_key, firstRow)).toBeNull();
    expect(openBound(oldSecret, secondRow.encrypted_key, secondRow)).toBeNull();

    const check = runScript(newOne, "", false);
    expect(check.code, check.out).toBe(0);
  });

  test("gibt weder Secrets noch Keys noch Chiffretexte aus", async () => {
    const secret = newSecret();
    await insertKey(first, "anthropic", legacyBlob(secret, "sk-ant-erster"));
    const before = (await rowsOf(first))[0].encrypted_key;

    const { out, code } = runScript(secret, "", true);
    expect(code).toBe(0);
    const after = (await rowsOf(first))[0].encrypted_key;
    for (const leak of [secret, "sk-ant-erster", before, after, localSupabase().serviceRoleKey]) {
      expect(out).not.toContain(leak);
    }
  });
});
