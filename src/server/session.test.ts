import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Der Key-Hinweis im Chat (getNeedsOwnKey, getFreePromptsLeft): im Einzelbetrieb auf dem Endpunkt des Betreibers
// sieht ein Free-Konto ohne Key keinen Hinweis, sonst wie bisher.

const getUser = vi.fn();
let plan = "free";
let keys: unknown[] = [];
vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      const result =
        table === "profiles"
          ? { data: { plan, is_admin: false, display_name: null, settings: null }, error: null }
          : { data: keys, error: null };
      const chain = {
        select: () => chain,
        eq: () => chain,
        limit: async () => result,
        maybeSingle: async () => result,
      };
      return chain;
    },
  }),
}));

const freePromptsLeft = vi.fn();
vi.mock("@/server/free-trial", () => ({ freePromptsLeft: (...a: unknown[]) => freePromptsLeft(...a) }));

beforeEach(() => {
  vi.resetModules();
  plan = "free";
  keys = [];
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  freePromptsLeft.mockReset();
  freePromptsLeft.mockResolvedValue(0);
  for (const [name, value] of Object.entries({
    ZAI_API_KEY: "",
    GEMINI_API_KEY: "",
    VERCEL: "",
    SELF_HOSTED: "1",
    LLM_BASE_URL: "http://localhost:11434/v1",
    LLM_MODEL: "qwen3",
  })) {
    vi.stubEnv(name, value);
  }
});
afterEach(() => vi.unstubAllEnvs());

// Frisch geladen, damit React `cache()` keinen Wert aus einem anderen Test hält.
const load = () => import("@/server/session");

describe("Key-Hinweis im Chat", () => {
  it("im Einzelbetrieb auf dem eigenen Endpunkt: kein Hinweis, kein Gratis-Zähler", async () => {
    const { getNeedsOwnKey, getFreePromptsLeft } = await load();
    expect(await getNeedsOwnKey()).toBe(false);
    expect(await getFreePromptsLeft()).toBeNull();
    expect(freePromptsLeft).not.toHaveBeenCalled();
  });

  it.each([
    ["ohne SELF_HOSTED", { SELF_HOSTED: "" }],
    ["auf Vercel", { VERCEL: "1" }],
    ["auf Z.ai", { ZAI_API_KEY: "zk" }],
  ])("sonst wie bisher: Free ohne Key und ohne Gratis-Prompts braucht einen Key, %s", async (_label, env) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const { getNeedsOwnKey } = await load();
    expect(await getNeedsOwnKey()).toBe(true);
  });

  // Eine Zeile mit plan = 'pro' bleibt in der Datenbank stehen und ist Free (shared/lib/plans.ts).
  it("eine alte Zeile mit plan = 'pro' ohne Key ist Free: erst der Gratis-Zähler, danach der Key-Hinweis", async () => {
    vi.stubEnv("SELF_HOSTED", "");
    plan = "pro";
    freePromptsLeft.mockResolvedValue(2);
    const inTrial = await load();
    expect(await inTrial.getNeedsOwnKey()).toBe(false);
    expect(await inTrial.getFreePromptsLeft()).toBe(2);

    vi.resetModules();
    freePromptsLeft.mockResolvedValue(0);
    const afterTrial = await load();
    expect(await afterTrial.getNeedsOwnKey()).toBe(true);
    expect(await afterTrial.getFreePromptsLeft()).toBeNull();
  });
});
