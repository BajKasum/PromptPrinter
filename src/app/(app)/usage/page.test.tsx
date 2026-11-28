import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tablesClient, type Row, type TablesClientOptions } from "@tests/support/supabase-tables";
import { FREE_TRIAL, PLAN_LIMITS } from "@/shared/lib/plans";
import { fmt, plural } from "@/shared/i18n/format";
import { de } from "@/shared/i18n/messages/de";
import UsagePage from "./page";

// "Nutzung": die eigenen Projekte und Gratis-Prompts, und nur für Admins die Zahlen quer über alle Konten. Letztere
// kommen über den Service-Role-Client, der RLS umgeht: er darf für niemanden sonst entstehen.
const m = de.pages.usage;
// Die Uhr steht mitten in einem Monat: "heute" und "diesen Monat" hängen sonst am Zeitpunkt des Laufs.
const NOW = new Date("2026-11-15T12:00:00.000Z");

let client = tablesClient();
let admin = tablesClient();
const createAdminClient = vi.fn(() => admin);
const getConfiguredProviders = vi.fn(async (..._args: unknown[]): Promise<string[]> => []);
const freePromptsLeft = vi.fn(async (..._args: unknown[]): Promise<number | null> => FREE_TRIAL.prompts);
const selfHosted = vi.fn(() => false);
const readDailyServerKeyUsage = vi.fn(async (): Promise<{ used: number; budget: number } | null> => null);
const alertingConfigured = vi.fn(() => false);
const llmConfig = vi.fn((): { provider: string; model: string } | null => null);
const loadActivationFunnel = vi.fn(async (..._args: unknown[]) => ({ weeks: [], truncated: false, limit: 300 }));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/server/supabase/server", () => ({ createClient: async () => client }));
vi.mock("@/server/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));
vi.mock("@/server/session", () => ({ getSessionUser: async () => ({ id: "user-1" }) }));
vi.mock("@/server/byok", () => ({ getConfiguredProviders: (...a: unknown[]) => getConfiguredProviders(...a) }));
vi.mock("@/server/free-trial", () => ({ freePromptsLeft: (...a: unknown[]) => freePromptsLeft(...a) }));
vi.mock("@/server/llm", () => ({ selfHostedEndpointActive: () => selfHosted(), llmConfig: () => llmConfig() }));
vi.mock("@/server/security/rate-limit", () => ({ readDailyServerKeyUsage: () => readDailyServerKeyUsage() }));
vi.mock("@/server/observability/alerting", () => ({ alertingConfigured: () => alertingConfigured() }));
vi.mock("@/server/activation-funnel", () => ({ loadActivationFunnel: (...a: unknown[]) => loadActivationFunnel(...a) }));
vi.mock("@/server/i18n", async () => {
  const { de } = await import("@/shared/i18n/messages/de");
  return { getT: async () => de, getLocale: async () => "de" };
});
vi.mock("@/shared/motion/fade-in", () => ({ FadeIn: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/features/settings/components/activation-funnel", () => ({
  ActivationFunnelCard: () => <p>Aktivierung</p>,
}));

/**
 * Die Seite enthält mit "Betrieb" eine zweite Server-Komponente (`async`), die der Browser-Renderer der Tests nicht
 * ausführt. Das hier wertet solche Komponenten im Baum vorher aus.
 */
async function resolveServerTree(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveServerTree));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function" && element.type.constructor.name === "AsyncFunction") {
    const render = element.type as unknown as (props: unknown) => Promise<ReactNode>;
    return resolveServerTree(await render(element.props));
  }
  if (element.props.children === undefined) return element;
  const children = await Promise.all(Children.toArray(element.props.children).map(resolveServerTree));
  return cloneElement(element, undefined, ...children);
}

const open = async () => render(<>{await resolveServerTree(await UsagePage())}</>);

const profile = (overrides: Row = {}): Row => ({ id: "user-1", plan: "free", is_admin: false, ...overrides });
const projectRow = (userId: string, n: number): Row => ({ id: `${userId}-${n}`, user_id: userId });

function withTables(options: TablesClientOptions = {}) {
  client = tablesClient({
    ...options,
    tables: { profiles: [profile()], projects: [], ...options.tables },
  });
}

/** Der Block eines Zählers, an seiner Beschriftung. */
const meter = (label: string) => screen.getByText(label, { selector: "span" }).closest("div")!.parentElement!;

/** Die Kachel einer Kennzahl im Betrieb, an ihrer Beschriftung. */
const card = (label: string) => screen.getByText(label).parentElement!;
/** Nur die grosse Zahl der Kachel, zwischen Beschriftung und Hinweis. */
const tileValue = (label: string) => card(label).children[1].textContent;

afterEach(() => vi.useRealTimers());
beforeEach(() => {
  // Nur das Datum steht still, Zeitgeber laufen weiter.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  withTables();
  admin = tablesClient();
  createAdminClient.mockClear();
  getConfiguredProviders.mockReset();
  getConfiguredProviders.mockResolvedValue([]);
  freePromptsLeft.mockReset();
  freePromptsLeft.mockResolvedValue(FREE_TRIAL.prompts);
  selfHosted.mockReturnValue(false);
  readDailyServerKeyUsage.mockReset();
  readDailyServerKeyUsage.mockResolvedValue(null);
  alertingConfigured.mockReturnValue(false);
  llmConfig.mockReturnValue(null);
  loadActivationFunnel.mockClear();
});

describe("UsagePage: das eigene Konto", () => {
  it("zählt nur die eigenen Projekte gegen die Grenze", async () => {
    withTables({ tables: { projects: [projectRow("user-1", 1), projectRow("user-1", 2), projectRow("user-2", 3)] } });

    await open();

    expect(meter(m.projects)).toHaveTextContent(`2 / ${PLAN_LIMITS.free.projects}`);
    const read = client.reads.find((r) => r.table === "projects");
    expect(read?.filters).toEqual([["eq", "user_id", "user-1"]]);
    expect(client.reads.find((r) => r.table === "profiles")?.filters).toEqual([["eq", "id", "user-1"]]);
    expect(getConfiguredProviders).toHaveBeenCalledWith(client, "user-1");
  });

  it.each([
    [FREE_TRIAL.prompts, 0, plural(m.freePromptsLeft, FREE_TRIAL.prompts, "de")],
    [1, FREE_TRIAL.prompts - 1, plural(m.freePromptsLeft, 1, "de")],
    [0, FREE_TRIAL.prompts, m.freePromptsUsedUp],
  ])("zeigt ohne eigenen Key bei %i übrigen Prompts %i verbrauchte", async (left, used, text) => {
    freePromptsLeft.mockResolvedValue(left);

    await open();

    expect(freePromptsLeft).toHaveBeenCalledWith("user-1");
    expect(meter(m.freePrompts)).toHaveTextContent(`${used} / ${FREE_TRIAL.prompts}`);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByText(m.ownKeyNone)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: m.ownKeyLink })).toHaveAttribute("href", "/settings#api-keys");
  });

  it("sagt ohne zählbaren Stand, dass er sich nicht lesen lässt, statt 'aufgebraucht' zu behaupten", async () => {
    freePromptsLeft.mockResolvedValue(null);

    await open();

    expect(screen.getByText(m.freePromptsUnknown)).toBeInTheDocument();
    expect(screen.queryByText(m.freePromptsUsedUp)).not.toBeInTheDocument();
  });

  it.each([
    ["mit eigenem Key", () => getConfiguredProviders.mockResolvedValue(["openai"]), m.freePromptsOwnKey, m.ownKeySet],
    ["im Einzelbetrieb", () => selfHosted.mockReturnValue(true), m.freePromptsSelfHosted, m.ownKeyNone],
    ["als Admin", () => withTables({ tables: { profiles: [profile({ is_admin: true })] } }), m.freePromptsAdmin, m.ownKeyNone],
  ])("zählt %s keine Gratis-Prompts und sagt warum", async (_name, setup, reason, key) => {
    setup();

    await open();

    expect(freePromptsLeft).not.toHaveBeenCalled();
    expect(screen.getByText(reason)).toBeInTheDocument();
    expect(screen.getByText(key)).toBeInTheDocument();
  });

  it("erklärt Free mit Gratis-Prompts und Projekt-Grenze, den Einzelbetrieb ohne Gratis-Rahmen", async () => {
    const { unmount } = await open();
    const note = fmt(m.note, { prompts: FREE_TRIAL.prompts, projects: PLAN_LIMITS.free.projects });
    expect(screen.getByText(note)).toBeInTheDocument();
    unmount();

    selfHosted.mockReturnValue(true);
    await open();
    expect(screen.getByText(fmt(m.noteSelfHosted, { projects: PLAN_LIMITS.free.projects }))).toBeInTheDocument();
  });

  it.each(["profiles", "projects"])("wirft bei einem Lesefehler (%s)", async (table) => {
    withTables({ errors: { [table]: "timeout" } });
    await expect(open()).rejects.toThrow(`database read failed: ${table}`);
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("UsagePage: Betrieb", () => {
  const asAdmin = () => withTables({ tables: { profiles: [profile({ is_admin: true })] } });

  it.each([
    ["ein normales Konto", () => withTables()],
    ["eine alte Zeile mit plan = 'pro'", () => withTables({ tables: { profiles: [profile({ plan: "pro" })] } })],
    ["ein Konto ohne Profilzeile", () => withTables({ tables: { profiles: [] } })],
  ])("bleibt für %s unsichtbar und liest nichts über alle Konten", async (_name, setup) => {
    setup();

    await open();

    expect(screen.queryByText(m.ops.title)).not.toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(readDailyServerKeyUsage).not.toHaveBeenCalled();
    expect(loadActivationFunnel).not.toHaveBeenCalled();
  });

  const reply = (n: number, createdAt: string, role = "assistant"): Row => ({ id: `m-${n}`, role, created_at: createdAt });

  it("zeigt einem Admin Konten und Antworten über alle Nutzer: heute ab 00:00 UTC, den Monat ab dem Ersten", async () => {
    asAdmin();
    // Je eine Antwort an beiden Seiten jeder Grenze; die drei Kacheln bekommen verschiedene Zahlen.
    admin = tablesClient({
      tables: {
        profiles: Array.from({ length: 7 }, (_, i) => profile({ id: `user-${i + 1}` })),
        messages: [
          reply(1, "2026-11-15T11:59:00.000Z"),
          reply(2, "2026-11-15T00:00:00.000Z"),
          reply(3, "2026-11-14T23:59:59.999Z"),
          reply(4, "2026-11-02T08:00:00.000Z"),
          reply(5, "2026-11-01T00:00:00.000Z"),
          reply(6, "2026-10-31T23:59:59.999Z"),
          reply(7, "2026-10-15T12:00:00.000Z"),
          // Fragen der Nutzer sind keine Antworten.
          reply(8, "2026-11-15T10:00:00.000Z", "user"),
          reply(9, "2026-11-05T10:00:00.000Z", "user"),
        ],
      },
    });

    await open();

    expect(screen.getByText(m.ops.title)).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Aktivierung")).toBeInTheDocument();
    expect(tileValue(m.ops.accounts)).toBe("7");
    expect(tileValue(m.ops.repliesToday)).toBe("2");
    expect(tileValue(m.ops.repliesMonth)).toBe("5");
    // Je Antwort des Monats 0,012 $ im schlechtesten gemessenen Fall.
    expect(card(m.ops.repliesMonth)).toHaveTextContent(fmt(m.ops.repliesMonthHint, { cost: "0.06" }));
    // Gezählt wird ohne die Zeilen zu holen: kein Inhalt verlässt die Datenbank.
    expect(admin.reads.length).toBeGreaterThan(0);
    expect(admin.reads.every((read) => read.head)).toBe(true);
    expect(loadActivationFunnel).toHaveBeenCalledWith(admin, NOW);
  });

  it("sagt ohne Redis, dass es keine Tagesbremse gibt, und zeigt sonst den Stand", async () => {
    asAdmin();
    const { unmount } = await open();
    expect(screen.getByText(m.ops.noUpstash)).toBeInTheDocument();
    unmount();

    readDailyServerKeyUsage.mockResolvedValue({ used: 12, budget: 500 });
    await open();
    expect(screen.queryByText(m.ops.noUpstash)).not.toBeInTheDocument();
    expect(meter(m.ops.callsToday)).toHaveTextContent("12 / 500");
  });

  it("warnt nur ohne Alarm-Webhook", async () => {
    asAdmin();
    const { unmount } = await open();
    expect(screen.getByText("ALERT_WEBHOOK_URL")).toBeInTheDocument();
    unmount();

    alertingConfigured.mockReturnValue(true);
    await open();
    expect(screen.queryByText("ALERT_WEBHOOK_URL")).not.toBeInTheDocument();
  });

  it.each([
    ["den Anbieter", { provider: "zai", model: "glm-4.5-air" }, fmt(m.ops.provider, { provider: "zai", model: "glm-4.5-air" })],
    ["den Stub-Modus", null, m.ops.stub],
  ])("nennt %s", async (_name, config, text) => {
    asAdmin();
    llmConfig.mockReturnValue(config);

    await open();

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it.each(["profiles", "messages"])("wirft bei einem Lesefehler über alle Konten (%s)", async (table) => {
    asAdmin();
    admin = tablesClient({ errors: { [table]: "timeout" } });
    await expect(open()).rejects.toThrow(`database read failed: ${table}`);
  });
});
