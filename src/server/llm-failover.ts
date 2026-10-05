import "server-only";

import { Redis } from "@upstash/redis";
import { attemptsOf, transientReason } from "@/server/llm-retry";
import { reserveFailoverCall } from "@/server/security/rate-limit";
import { logEvent, logWarning } from "@/shared/lib/observability";

// Umschalten auf Gemini, wenn Z.ai ausfaellt (Betriebs-Audit M3, 05.10.2026).
//
// ─── Warum es das braucht ──────────────────────────────────────────────────
// llm-retry.ts faengt kurze Aussetzer ab: drei Versuche in rund zwei Sekunden.
// Faellt Z.ai laenger aus, ist der Chat fuer jeden Nutzer ohne eigenen Key tot,
// und nichts schaltet um. llmConfig() waehlt Gemini nur, wenn ZAI_API_KEY FEHLT:
// eine Auswahl beim Start, kein Umschalten bei einem Ausfall. Die
// Datenschutzerklaerung nennt Gemini trotzdem als "Ausweich-Anbieter, falls
// Z.ai nicht verfuegbar ist", das war bis hierher nicht wahr.
//
// ─── Wann umgeschaltet wird ────────────────────────────────────────────────
// Nur wenn alles zutrifft:
//   1. Es ist der Server-Key im Spiel. Wer seinen eigenen Key mitbringt (BYOK),
//      landet nie auf dem Konto des Betreibers: andere Kosten, andere Daten.
//   2. Beide Server-Keys sind gesetzt (failoverEnabled).
//   3. Die Versuche gegen Z.ai sind erschoepft (llm-retry.ts) UND der Fehler ist
//      ein AUSFALL: Netzabbruch, 408/425/429 ohne Guthaben-Text, 5xx, oder kein
//      erstes Textstueck innerhalb des Zeitlimits (llm.ts).
//   4. Bei einem Stream ist noch KEIN Textstueck beim Nutzer angekommen, sonst
//      begaenne die Antwort von vorn und das Gelesene verdoppelte sich.
//   5. Das Failover-Tagesbudget ist nicht aufgebraucht (rate-limit.ts).
//
// ─── Wann NICHT ────────────────────────────────────────────────────────────
// 400/401/403/404/422 (falscher Key oder falsche Anfrage, Gemini haette dasselbe
// Problem oder verdeckte eine kaputte Konfiguration), ein 429 mit aufgebrauchtem
// Guthaben (das soll jemand SEHEN, nicht still auf eine teurere Rechnung
// umleiten), eine leere Antwort (modell-, nicht ausfallbedingt), und jeder
// Abbruch durch den Nutzer.
//
// ─── Leistungsschalter ─────────────────────────────────────────────────────
// Ohne ihn liefe jeder Zug waehrend eines Ausfalls erst dreimal gegen den toten
// Anbieter, bevor er auf Gemini kaeme. Der Schalter merkt sich den Ausfall fuer
// ALLE Instanzen (Redis):
//   - 3 gescheiterte Zuege in Folge innerhalb von 2 Minuten oeffnen ihn.
//   - Geoeffnet gehen die Zuege fuer 60 Sekunden direkt zu Gemini.
//   - Danach "Bewaehrung" (5 Minuten): ein Zug versucht Z.ai wieder. Gelingt er,
//     ist der Schalter zu. Scheitert er, ist er sofort wieder offen, ohne erneut
//     drei Zuege zu brauchen.
// Ohne Redis (lokal) gilt derselbe Ablauf pro Prozess. Faellt Redis aus, gilt der
// Schalter als zu: es wird wie bisher zuerst Z.ai gefragt.
//
// ─── Kosten ────────────────────────────────────────────────────────────────
// Ein Zug zaehlt weiter einmal gegen Monatskontingent und das normale
// Tagesbudget (die Reservierung steht in der Route, vor dem Aufruf). Zusaetzlich
// belegt ein Failover-Zug einen Platz im eigenen Budget, weil Gemini je Zug etwa
// das Achtfache kostet. Scheitert auch Gemini, wird der Platz zurueckgegeben.

export type ServerProvider = "zai" | "gemini";

/** Beide Server-Keys da: nur dann gibt es ueberhaupt etwas, auf das umzuschalten waere. */
export function failoverEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.ZAI_API_KEY?.trim()) && Boolean(env.GEMINI_API_KEY?.trim());
}

/**
 * Ist das ein AUSFALL des Anbieters, und wenn ja, warum (fuer das Log)?
 *
 * Bewusst enger als "irgendein Fehler": siehe "Wann NICHT" oben. Baut auf
 * transientReason() auf (408/425/429 ohne Guthaben-Text, 5xx, Netzabbruch) und
 * nimmt das Zeitlimit dazu, das llm-retry.ts nie wiederholt, bei dem aber ein
 * ANDERER Anbieter genau die richtige Antwort ist.
 */
export function outageReason(err: unknown): string | null {
  if (!err) return null;
  // Der Nutzer hat selbst abgebrochen: kein Ausfall.
  if (err instanceof DOMException && err.name === "AbortError") return null;
  if (err instanceof Error && (err.name === "AbortError" || err.name === "LlmEmptyReplyError")) {
    return null;
  }
  if (err instanceof DOMException && err.name === "TimeoutError") return "timeout";
  return transientReason(err);
}

// ─── Der Leistungsschalter ─────────────────────────────────────────────────

/** Was der Schalter braucht: Schluessel mit Ablaufzeit, mehr nicht. */
export type BreakerStore = {
  exists(keys: string[]): Promise<boolean[]>;
  set(key: string, ttlSeconds: number): Promise<void>;
  /** Zaehlt hoch; setzt die Ablaufzeit beim ersten Mal. */
  incr(key: string, ttlSeconds: number): Promise<number>;
  del(keys: string[]): Promise<void>;
};

export const BREAKER_CONFIG = {
  /** Gescheiterte Zuege in Folge, die den Schalter oeffnen. */
  failuresToOpen: 3,
  /** In diesem Fenster muessen sie liegen. */
  failureWindowSeconds: 120,
  /** So lange gehen Zuege direkt zu Gemini. */
  openSeconds: 60,
  /** Danach so lange gilt ein einzelner Fehlschlag als sofortiges Wiederoeffnen. */
  probationSeconds: 300,
} as const;

const KEY_OPEN = "llm-breaker:zai:open";
const KEY_PROBATION = "llm-breaker:zai:probation";
const KEY_FAILS = "llm-breaker:zai:fails";

export type Breaker = {
  /** Wohin der naechste Zug geht, und ob er ein Probeaufruf nach einer Pause ist. */
  pick(): Promise<{ provider: ServerProvider; probe: boolean }>;
  /** Ein Zug ist an einem Ausfall von Z.ai gescheitert. */
  recordFailure(): Promise<void>;
  /** Ein Zug gegen Z.ai ist durchgegangen. Nur ein Probeaufruf aendert etwas. */
  recordSuccess(probe: boolean): Promise<void>;
};

export function createBreaker(store: BreakerStore): Breaker {
  const { failuresToOpen, failureWindowSeconds, openSeconds, probationSeconds } = BREAKER_CONFIG;

  async function open(reason: string, failures?: number) {
    await store.set(KEY_OPEN, openSeconds);
    await store.set(KEY_PROBATION, probationSeconds);
    await store.del([KEY_FAILS]);
    logWarning("llm.breaker_open", { provider: "zai", reason, failures, openSeconds });
  }

  return {
    async pick() {
      try {
        const [isOpen, onProbation] = await store.exists([KEY_OPEN, KEY_PROBATION]);
        if (isOpen) return { provider: "gemini", probe: false };
        return { provider: "zai", probe: onProbation };
      } catch {
        // Redis weg: wie bisher zuerst Z.ai fragen, nie wegen des Schalters ausfallen.
        return { provider: "zai", probe: false };
      }
    },

    async recordFailure() {
      try {
        const [, onProbation] = await store.exists([KEY_OPEN, KEY_PROBATION]);
        if (onProbation) {
          await open("probe_failed");
          return;
        }
        const failures = await store.incr(KEY_FAILS, failureWindowSeconds);
        if (failures >= failuresToOpen) await open("threshold", failures);
      } catch {
        // Best effort: ein verlorener Zaehler heisst nur, dass es einen Zug laenger dauert.
      }
    },

    async recordSuccess(probe: boolean) {
      if (!probe) return;
      try {
        await store.del([KEY_PROBATION, KEY_FAILS]);
        logEvent("llm.breaker_closed", { provider: "zai" });
      } catch {
        // Die Bewaehrung laeuft von selbst ab.
      }
    },
  };
}

/** Pro Prozess, fuer lokal ohne Redis und fuer die Tests. `now` ist austauschbar. */
export function createMemoryStore(now: () => number = Date.now): BreakerStore {
  const entries = new Map<string, { value: number; expiresAt: number }>();

  function live(key: string) {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now()) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  }

  return {
    async exists(keys) {
      return keys.map((key) => live(key) !== undefined);
    },
    async set(key, ttlSeconds) {
      entries.set(key, { value: 1, expiresAt: now() + ttlSeconds * 1000 });
    },
    async incr(key, ttlSeconds) {
      const entry = live(key);
      if (entry) {
        entry.value += 1;
        return entry.value;
      }
      entries.set(key, { value: 1, expiresAt: now() + ttlSeconds * 1000 });
      return 1;
    },
    async del(keys) {
      for (const key of keys) entries.delete(key);
    },
  };
}

function createRedisStore(redis: Redis): BreakerStore {
  return {
    async exists(keys) {
      const values = await redis.mget<(string | number | null)[]>(...keys);
      return values.map((value) => value !== null && value !== undefined);
    },
    async set(key, ttlSeconds) {
      await redis.set(key, "1", { ex: ttlSeconds });
    },
    async incr(key, ttlSeconds) {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, ttlSeconds);
      return count;
    },
    async del(keys) {
      await redis.del(...keys);
    },
  };
}

let sharedBreaker: Breaker | undefined;

/** Nur fuer Tests: vergisst den Schalter dieses Prozesses, damit kein Test den Zustand des vorigen erbt. */
export function __resetServerBreakerForTests(): void {
  sharedBreaker = undefined;
}

/** Der Schalter dieses Prozesses: Redis, wenn konfiguriert, sonst Speicher. */
export function serverBreaker(): Breaker {
  if (!sharedBreaker) {
    const store =
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? createRedisStore(Redis.fromEnv())
        : createMemoryStore();
    sharedBreaker = createBreaker(store);
  }
  return sharedBreaker;
}

// ─── Der Ablauf ────────────────────────────────────────────────────────────

export type FailoverOptions = {
  signal?: AbortSignal;
  /** Wird gerufen, bevor ein Anbieter gefragt wird, damit die Route den echten kennt. */
  onProvider?: (provider: ServerProvider) => void;
  /** Nur fuer Tests. */
  breaker?: Breaker;
};

type Slot = { release: () => Promise<void> };
const NO_SLOT: Slot = { release: async () => {} };

/**
 * Darf nach diesem Fehler umgeschaltet werden? Gibt den belegten Platz im
 * Failover-Budget zurueck, oder null, wenn der Fehler stehen bleiben soll.
 */
async function claimFailover(err: unknown, opts: FailoverOptions, breaker: Breaker): Promise<Slot | null> {
  const reason = outageReason(err);
  if (!reason) return null;
  if (opts.signal?.aborted) return null;

  await breaker.recordFailure();

  const slot = await reserveFailoverCall();
  if (slot && !slot.allowed) {
    // rate-limit.ts hat die Warnung schon geschrieben.
    await slot.release();
    return null;
  }

  logWarning("llm.failover", {
    from: "zai",
    to: "gemini",
    reason,
    attempts: attemptsOf(err),
  });
  return slot ?? NO_SLOT;
}

/** Ist der Schalter offen, geht der Zug direkt zu Gemini, solange das Budget es erlaubt. */
async function claimDirectGemini(): Promise<Slot | null> {
  const slot = await reserveFailoverCall();
  if (slot && !slot.allowed) {
    await slot.release();
    return null;
  }
  return slot ?? NO_SLOT;
}

/**
 * Ein Stream mit Ausweich-Anbieter. `run(provider)` startet den Stream gegen den
 * genannten Anbieter (samt dessen Wiederholungen, siehe llm.ts).
 */
export async function* streamWithFailover(
  run: (provider: ServerProvider) => AsyncGenerator<string>,
  opts: FailoverOptions = {}
): AsyncGenerator<string> {
  const breaker = opts.breaker ?? serverBreaker();
  const pick = await breaker.pick();

  if (pick.provider === "gemini") {
    const slot = await claimDirectGemini();
    if (slot) {
      opts.onProvider?.("gemini");
      try {
        yield* run("gemini");
        return;
      } catch (err) {
        await slot.release();
        throw err;
      }
    }
    // Budget aufgebraucht: lieber Z.ai doch noch fragen als gar nichts liefern.
  }

  opts.onProvider?.("zai");
  let delivered = false;
  try {
    for await (const chunk of run("zai")) {
      delivered = true;
      yield chunk;
    }
  } catch (err) {
    if (delivered) throw err;
    const slot = await claimFailover(err, opts, breaker);
    if (!slot) throw err;

    opts.onProvider?.("gemini");
    try {
      yield* run("gemini");
    } catch (second) {
      await slot.release();
      throw second;
    }
    return;
  }
  await breaker.recordSuccess(pick.probe);
}

/** Dasselbe fuer einen Aufruf, der eine fertige Antwort liefert (Projekt-Analyse). */
export async function callWithFailover<T>(
  run: (provider: ServerProvider) => Promise<T>,
  opts: FailoverOptions = {}
): Promise<T> {
  const breaker = opts.breaker ?? serverBreaker();
  const pick = await breaker.pick();

  if (pick.provider === "gemini") {
    const slot = await claimDirectGemini();
    if (slot) {
      opts.onProvider?.("gemini");
      try {
        return await run("gemini");
      } catch (err) {
        await slot.release();
        throw err;
      }
    }
  }

  opts.onProvider?.("zai");
  try {
    const result = await run("zai");
    await breaker.recordSuccess(pick.probe);
    return result;
  } catch (err) {
    const slot = await claimFailover(err, opts, breaker);
    if (!slot) throw err;

    opts.onProvider?.("gemini");
    try {
      return await run("gemini");
    } catch (second) {
      await slot.release();
      throw second;
    }
  }
}
