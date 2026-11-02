import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DENIAL_SAMPLE_RATE,
  denied,
  logRateLimited,
  logSecurityEvent,
  safeSecurityContext,
} from "@/server/security/security-log";

const ALWAYS = () => 0;
const NEVER = () => 0.99;

let lines: string[];

beforeEach(() => {
  lines = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => void lines.push(line));
});

afterEach(() => {
  vi.restoreAllMocks();
});

const lastEntry = () => JSON.parse(lines.at(-1) ?? "{}") as Record<string, unknown>;

describe("logSecurityEvent", () => {
  it("schreibt genau eine strukturierte Zeile mit Ereignis und Kennung", () => {
    logSecurityEvent("auth.sign_in_succeeded", { userId: "user-1" });
    expect(lines).toHaveLength(1);
    expect(lastEntry()).toMatchObject({ level: "info", event: "auth.sign_in_succeeded", userId: "user-1" });
  });

  // Der Kontext aus der Hölle: alles, was je versehentlich mitkommen könnte, unter passenden und unter harmlosen Namen.
  it("lässt aus einem feindlichen Kontext keine Adresse, keinen Key und keinen Inhalt durch", () => {
    const secrets = [
      "opfer@example.com",
      "zweite.adresse+tag@example.org",
      "sk-ant-api03-GEHEIM",
      "sk-proj-GEHEIM",
      "AIzaSyGEHEIM-gemini",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl",
      "mein geheimer Prompt",
      "Passwort123!",
    ];
    logSecurityEvent("auth.sign_in_failed", {
      email: "opfer@example.com",
      userEmail: "opfer@example.com",
      apiKey: "sk-ant-api03-GEHEIM",
      encrypted_key: "sk-proj-GEHEIM",
      accessToken: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl",
      password: "Passwort123!",
      prompt: "mein geheimer Prompt",
      content: "mein geheimer Prompt",
      // Harmlose Namen, gefährliche Werte: redactContext sieht nur den Namen.
      reason: "Login für opfer@example.com abgelehnt",
      note: "schlug fehl mit sk-ant-api03-GEHEIM und AIzaSyGEHEIM-gemini",
      detail: { nested: "von zweite.adresse+tag@example.org mit eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl" },
      userId: "user-1",
    });
    const line = lines.join("\n");
    for (const secret of secrets) expect(line).not.toContain(secret);
    expect(lastEntry().userId).toBe("user-1");
    expect(lastEntry().reason).toBe("Login für [adresse] abgelehnt");
    expect(lastEntry().note).toBe("schlug fehl mit [schluessel] und [schluessel]");
  });
});

describe("safeSecurityContext", () => {
  it("schwärzt Felder nach ihrem Namen, auch wenn der Wert harmlos aussieht", () => {
    expect(safeSecurityContext({ password: "Passwort123!", prompt: "mein Text", apiKey: "abc" })).toEqual({
      password: "[redacted]",
      prompt: "[redacted]",
      apiKey: "[redacted]",
    });
  });

  it("lässt Kennungen, Zahlen und Wahrheitswerte stehen", () => {
    expect(safeSecurityContext({ provider: "openai", replaced: true, count: 3, none: null })).toEqual({
      provider: "openai",
      replaced: true,
      count: 3,
      none: null,
    });
  });
});

describe("denied", () => {
  it("gibt die Antwort unverändert zurück, geloggt oder nicht", () => {
    const response = new Response("nein", { status: 401 });
    expect(denied("projects", response, {}, ALWAYS)).toBe(response);
    expect(denied("projects", response, {}, NEVER)).toBe(response);
  });

  it("nennt Route, Status und die Stichprobe, damit sich die Zeile hochrechnen lässt", () => {
    denied("brain", new Response(null, { status: 404 }), { userId: "user-1", projectId: "p-1" }, ALWAYS);
    expect(lastEntry()).toMatchObject({
      event: "access.denied",
      route: "brain",
      status: 404,
      userId: "user-1",
      projectId: "p-1",
      sampleRate: DENIAL_SAMPLE_RATE,
    });
  });

  it("schreibt ausserhalb der Stichprobe nichts", () => {
    denied("projects", new Response(null, { status: 401 }), {}, NEVER);
    expect(lines).toEqual([]);
  });

  it("nimmt rund jede zehnte Absage", () => {
    let i = 0;
    const evenly = () => (i++ % 100) / 100;
    for (let n = 0; n < 100; n += 1) denied("projects", new Response(null, { status: 401 }), {}, evenly);
    expect(lines).toHaveLength(10);
  });
});

describe("logRateLimited", () => {
  it("nennt Bereich und Konto eines angemeldeten Nutzers", () => {
    logRateLimited("projects:u:user-1", ALWAYS);
    expect(lastEntry()).toMatchObject({ event: "rate_limit.rejected", scope: "projects", userId: "user-1" });
  });

  it("nennt bei einer anonymen Anfrage nur den Bereich, nie die Adresse", () => {
    logRateLimited("auth:ip:203.0.113.7", ALWAYS);
    expect(lastEntry().scope).toBe("auth");
    expect(lines.join("\n")).not.toContain("203.0.113.7");
  });

  it("lässt auch eine IPv6-Adresse draussen", () => {
    logRateLimited("auth:ip:2001:db8::1", ALWAYS);
    expect(lines.join("\n")).not.toContain("2001");
  });

  it("schreibt ausserhalb der Stichprobe nichts", () => {
    logRateLimited("projects:u:user-1", NEVER);
    expect(lines).toEqual([]);
  });
});
