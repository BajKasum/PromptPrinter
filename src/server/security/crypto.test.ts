import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decrypt, encrypt } from "@/server/security/crypto";

// Jedes Secret entsteht hier zur Laufzeit: im Quelltext steht keins, auch nicht in den Tests.
const newSecret = () => randomBytes(32).toString("base64");

const ROW = { userId: "11111111-1111-4111-8111-111111111111", provider: "anthropic" };
const PLAIN = "sk-ant-api03-abc123";

function use(current: string | undefined, previous?: string) {
  if (current === undefined) vi.stubEnv("API_KEY_ENCRYPTION_SECRET", "");
  else vi.stubEnv("API_KEY_ENCRYPTION_SECRET", current);
  vi.stubEnv("API_KEY_ENCRYPTION_SECRET_PREVIOUS", previous ?? "");
}

/**
 * Das alte Format, hier eingefroren und nicht aus dem Code geholt: ein Wert, wie er bis zur Umstellung in die
 * Tabelle geschrieben wurde. Wer die Leseseite ändert, merkt es an diesem Test.
 */
function legacyBlob(secret: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", scryptSync(secret, "promptprinter-byok", 32), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("encrypt/decrypt", () => {
  it("bringt den Klartext zurück", () => {
    use(newSecret());
    expect(decrypt(encrypt(PLAIN, ROW), ROW)).toBe(PLAIN);
  });

  it("trägt Format und Schlüssel-ID vorn, nie den Klartext", () => {
    use(newSecret());
    const blob = encrypt(PLAIN, ROW);
    expect(blob).toMatch(/^pp2\.[0-9a-f]{8}\.[A-Za-z0-9_-]+$/);
    expect(blob).not.toContain(PLAIN);
  });

  it("verschlüsselt jeden Wert neu (zufälliger IV)", () => {
    use(newSecret());
    expect(encrypt(PLAIN, ROW)).not.toBe(encrypt(PLAIN, ROW));
  });

  it("wirft bei einem veränderten Chiffretext", () => {
    use(newSecret());
    const blob = encrypt(PLAIN, ROW);
    const [prefix, kid, payload] = blob.split(".");
    const raw = Buffer.from(payload, "base64url");
    raw[raw.length - 1] ^= 0xff;
    expect(() => decrypt(`${prefix}.${kid}.${raw.toString("base64url")}`, ROW)).toThrow();
  });

  it("wirft unter einem anderen Secret", () => {
    use(newSecret());
    const blob = encrypt(PLAIN, ROW);
    use(newSecret());
    expect(() => decrypt(blob, ROW)).toThrow();
  });

  it("wirft bei einem Wert ohne Nutzdaten", () => {
    use(newSecret());
    const [prefix, kid] = encrypt(PLAIN, ROW).split(".");
    expect(() => decrypt(`${prefix}.${kid}.`, ROW)).toThrow();
    expect(() => decrypt(`${prefix}.${kid}`, ROW)).toThrow();
  });
});

describe("Bindung an die Zeile", () => {
  const OTHER_USER = { ...ROW, userId: "22222222-2222-4222-8222-222222222222" };
  const OTHER_PROVIDER = { ...ROW, provider: "openai" };

  it("ein Wert aus der Zeile eines anderen Nutzers lässt sich nicht öffnen", () => {
    use(newSecret());
    expect(() => decrypt(encrypt(PLAIN, ROW), OTHER_USER)).toThrow();
  });

  it("ein Wert eines anderen Anbieters desselben Nutzers auch nicht", () => {
    use(newSecret());
    expect(() => decrypt(encrypt(PLAIN, ROW), OTHER_PROVIDER)).toThrow();
  });

  it("zwei getauschte Chiffretexte scheitern in beiden Zeilen", () => {
    use(newSecret());
    const mine = encrypt("sk-meiner", ROW);
    const theirs = encrypt("sk-fremder", OTHER_USER);
    expect(() => decrypt(theirs, ROW)).toThrow();
    expect(() => decrypt(mine, OTHER_USER)).toThrow();
  });
});

describe("altes Format", () => {
  it("wird weiter gelesen, ohne Bindung und unter demselben Secret", () => {
    const secret = newSecret();
    use(secret);
    expect(decrypt(legacyBlob(secret, PLAIN), ROW)).toBe(PLAIN);
  });

  it("wird auch während einer Rotation unter dem alten Secret gelesen", () => {
    const old = newSecret();
    use(newSecret(), old);
    expect(decrypt(legacyBlob(old, PLAIN), ROW)).toBe(PLAIN);
  });

  it("wirft, wenn kein Secret passt", () => {
    use(newSecret());
    expect(() => decrypt(legacyBlob(newSecret(), PLAIN), ROW)).toThrow();
  });

  it("wirft bei einem veränderten Wert, auch mit PREVIOUS", () => {
    const old = newSecret();
    const raw = Buffer.from(legacyBlob(old, PLAIN), "base64");
    raw[raw.length - 1] ^= 0xff;
    use(newSecret(), old);
    expect(() => decrypt(raw.toString("base64"), ROW)).toThrow();
  });

  it("ein neuer Wert schreibt nie mehr das alte Format", () => {
    use(newSecret());
    expect(encrypt(PLAIN, ROW).startsWith("pp2.")).toBe(true);
  });
});

// Ohne API_KEY_ENCRYPTION_SECRET_PREVIOUS macht jede Änderung des Secrets alle gespeicherten Keys unlesbar, und
// getUserOverride() meldet dann für jedes Konto "unreadable".
describe("Rotation mit API_KEY_ENCRYPTION_SECRET_PREVIOUS", () => {
  it("liest eine Zeile mit dem alten Secret weiter, sobald es als PREVIOUS gesetzt ist", () => {
    const [old, fresh] = [newSecret(), newSecret()];
    use(old);
    const blob = encrypt(PLAIN, ROW);

    use(fresh);
    expect(() => decrypt(blob, ROW)).toThrow();

    use(fresh, old);
    expect(decrypt(blob, ROW)).toBe(PLAIN);
  });

  it("schreibt nach der Umstellung nur noch unter dem neuen Secret", () => {
    const [old, fresh] = [newSecret(), newSecret()];
    use(fresh, old);
    const blob = encrypt(PLAIN, ROW);

    use(fresh);
    expect(decrypt(blob, ROW)).toBe(PLAIN);

    use(old);
    expect(() => decrypt(blob, ROW)).toThrow();
  });

  it("wirft, wenn weder das aktuelle noch das alte Secret die Zeile öffnet", () => {
    const third = newSecret();
    use(third);
    const blob = encrypt(PLAIN, ROW);
    use(newSecret(), newSecret());
    expect(() => decrypt(blob, ROW)).toThrow();
  });

  it("ignoriert ein PREVIOUS, das dem aktuellen Secret gleicht", () => {
    const same = newSecret();
    use(same, same);
    expect(decrypt(encrypt(PLAIN, ROW), ROW)).toBe(PLAIN);
  });
});

describe("ohne Secret", () => {
  it("wirft beim Verschlüsseln in jeder Umgebung", () => {
    for (const nodeEnv of ["production", "development", "test"]) {
      vi.stubEnv("NODE_ENV", nodeEnv);
      use(undefined);
      expect(() => encrypt(PLAIN, ROW), nodeEnv).toThrow("API_KEY_ENCRYPTION_SECRET is not configured");
    }
  });

  it("wirft beim Entschlüsseln, und PREVIOUS allein ersetzt das aktuelle Secret nicht", () => {
    const old = newSecret();
    use(old);
    const blob = encrypt(PLAIN, ROW);
    const legacy = legacyBlob(old, PLAIN);

    use(undefined, old);
    expect(() => decrypt(blob, ROW)).toThrow();
    expect(() => decrypt(legacy, ROW)).toThrow();
  });
});

describe("kein Schlüssel im Quelltext", () => {
  const source = readFileSync(join(process.cwd(), "src/server/security/crypto.ts"), "utf8");

  it("kennt keinen festen Rückfallwert mehr", () => {
    expect(source).not.toMatch(/fallback/i);
    expect(source).not.toMatch(/NODE_ENV/);
  });
});
