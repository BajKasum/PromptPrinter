import { describe, expect, it } from "vitest";
import {
  FUNNEL_MAX_ACCOUNTS,
  FUNNEL_WEEKS,
  buildFunnelWeeks,
  funnelSince,
  loadActivationFunnel,
  weekStartUtc,
} from "./activation-funnel";

// Donnerstag, 22.10.2026. Die laufende Woche beginnt am Montag, 19.10.2026.
const NOW = new Date("2026-10-22T10:00:00Z");

describe("weekStartUtc", () => {
  it("liefert den Montag 00:00 UTC der Woche", () => {
    expect(weekStartUtc(new Date("2026-10-22T10:00:00Z")).toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(weekStartUtc(new Date("2026-10-19T00:00:00Z")).toISOString()).toBe("2026-10-19T00:00:00.000Z");
  });

  it("rechnet den Sonntag zur Woche davor", () => {
    expect(weekStartUtc(new Date("2026-10-25T23:59:59Z")).toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(weekStartUtc(new Date("2026-10-26T00:00:00Z")).toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("geht über den Monatswechsel", () => {
    expect(weekStartUtc(new Date("2026-11-01T12:00:00Z")).toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
});

describe("funnelSince", () => {
  it("beginnt acht Wochen mit der laufenden", () => {
    expect(funnelSince(NOW).toISOString()).toBe("2026-08-31T00:00:00.000Z");
  });
});

const NO_SIGNALS = {
  withKey: new Set<string>(),
  withAnswer: new Set<string>(),
  withSavedPrompt: new Set<string>(),
};

describe("buildFunnelWeeks", () => {
  it("liefert alle Wochen, auch ohne Anmeldung, älteste zuerst", () => {
    const weeks = buildFunnelWeeks([], NO_SIGNALS, NOW);
    expect(weeks).toHaveLength(FUNNEL_WEEKS);
    expect(weeks[0].weekStart).toBe("2026-08-31");
    expect(weeks[FUNNEL_WEEKS - 1].weekStart).toBe("2026-10-19");
    expect(weeks.every((w) => w.signups === 0 && w.withKey === 0)).toBe(true);
  });

  it("zählt jedes Konto in der Woche seiner Anmeldung und seine Signale dazu", () => {
    const accounts = [
      { id: "a", created_at: "2026-10-20T08:00:00Z" },
      { id: "b", created_at: "2026-10-21T08:00:00Z" },
      { id: "c", created_at: "2026-10-12T08:00:00Z" },
    ];
    const weeks = buildFunnelWeeks(
      accounts,
      {
        withKey: new Set(["a", "b", "c"]),
        withAnswer: new Set(["a", "c"]),
        withSavedPrompt: new Set(["a"]),
      },
      NOW
    );
    const current = weeks[FUNNEL_WEEKS - 1];
    const before = weeks[FUNNEL_WEEKS - 2];
    expect(current).toMatchObject({ weekStart: "2026-10-19", signups: 2, withKey: 2, withAnswer: 1, withSavedPrompt: 1 });
    expect(before).toMatchObject({ weekStart: "2026-10-12", signups: 1, withKey: 1, withAnswer: 1, withSavedPrompt: 0 });
  });

  it("zählt kein Konto, das älter als das Fenster ist oder ein unlesbares Datum trägt", () => {
    const weeks = buildFunnelWeeks(
      [
        { id: "alt", created_at: "2026-08-30T23:59:59Z" },
        { id: "kaputt", created_at: "gestern" },
      ],
      { ...NO_SIGNALS, withKey: new Set(["alt", "kaputt"]) },
      NOW
    );
    expect(weeks.reduce((sum, w) => sum + w.signups, 0)).toBe(0);
    expect(weeks.reduce((sum, w) => sum + w.withKey, 0)).toBe(0);
  });

  it("zählt kein Konto aus der Zukunft", () => {
    const weeks = buildFunnelWeeks([{ id: "z", created_at: "2026-11-30T00:00:00Z" }], NO_SIGNALS, NOW);
    expect(weeks.reduce((sum, w) => sum + w.signups, 0)).toBe(0);
  });
});

// Ein Speicher mit der Abfragekette, die das Modul benutzt: select / gte / order / limit / eq.
type Row = Record<string, string>;
function fakeAdmin(tables: Record<string, Row[]>) {
  const calls: string[] = [];
  return {
    calls,
    from(table: string) {
      calls.push(table);
      let rows = [...(tables[table] ?? [])];
      let max = Infinity;
      const chain = {
        select: () => chain,
        gte: (column: string, value: string) => {
          rows = rows.filter((r) => r[column] >= value);
          return chain;
        },
        eq: (column: string, value: string) => {
          rows = rows.filter((r) => r[column] === value);
          return chain;
        },
        order: (column: string, opts: { ascending: boolean }) => {
          rows.sort((a, b) => (opts.ascending ? 1 : -1) * a[column].localeCompare(b[column]));
          return chain;
        },
        limit: (n: number) => {
          max = n;
          return chain;
        },
        then: (resolve: (v: { data: Row[] }) => unknown) => resolve({ data: rows.slice(0, max) }),
      };
      return chain;
    },
  };
}

describe("loadActivationFunnel", () => {
  it("verbindet Konten mit Key, Antwort und gespeichertem Prompt", async () => {
    const admin = fakeAdmin({
      profiles: [
        { id: "a", created_at: "2026-10-20T08:00:00Z" },
        { id: "b", created_at: "2026-10-21T08:00:00Z" },
        { id: "c", created_at: "2026-10-21T09:00:00Z" },
        { id: "alt", created_at: "2026-01-01T00:00:00Z" },
      ],
      user_api_keys: [{ user_id: "a" }, { user_id: "alt" }],
      // Eine Frage des Nutzers ist keine Antwort von Finn: b hat nur gefragt.
      messages: [
        { user_id: "a", role: "assistant" },
        { user_id: "b", role: "user" },
        { user_id: "c", role: "assistant" },
      ],
      generations: [{ user_id: "a" }, { user_id: "a" }],
    });

    const funnel = await loadActivationFunnel(admin as never, NOW);

    expect(funnel.truncated).toBe(false);
    expect(funnel.weeks[FUNNEL_WEEKS - 1]).toMatchObject({
      signups: 3,
      withKey: 1,
      withAnswer: 2,
      withSavedPrompt: 1,
    });
  });

  it("fragt nur Konten des Fensters ab, nicht alle", async () => {
    const admin = fakeAdmin({
      profiles: [
        { id: "a", created_at: "2026-10-20T08:00:00Z" },
        { id: "alt", created_at: "2026-01-01T00:00:00Z" },
      ],
    });
    await loadActivationFunnel(admin as never, NOW);
    // Ein Profil im Fenster: je Signal eine Abfrage, dazu die Profile selbst.
    expect(admin.calls.filter((t) => t !== "profiles")).toHaveLength(3);
  });

  it("meldet abgeschnittene Ansicht, wenn es mehr Konten gibt als die Obergrenze", async () => {
    const profiles = Array.from({ length: FUNNEL_MAX_ACCOUNTS + 1 }, (_, i) => ({
      id: `u${i}`,
      created_at: "2026-10-20T08:00:00Z",
    }));
    const funnel = await loadActivationFunnel(fakeAdmin({ profiles }) as never, NOW);
    expect(funnel.truncated).toBe(true);
    expect(funnel.weeks[FUNNEL_WEEKS - 1].signups).toBe(FUNNEL_MAX_ACCOUNTS);
  });

  it("liefert leere Wochen, wenn niemand sich angemeldet hat", async () => {
    const funnel = await loadActivationFunnel(fakeAdmin({}) as never, NOW);
    expect(funnel.truncated).toBe(false);
    expect(funnel.weeks).toHaveLength(FUNNEL_WEEKS);
    expect(funnel.weeks.every((w) => w.signups === 0)).toBe(true);
  });
});
