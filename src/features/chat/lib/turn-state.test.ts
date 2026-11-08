import { describe, expect, it } from "vitest";
import type { Msg } from "@/features/chat/lib/chat-wire";
import { initialTurnState, turnReducer, type TurnAction, type TurnState } from "./turn-state";

// Der Zustand eines Zugs ohne React (#212).

const u = (id: string, content = id): Msg => ({ id, role: "user", content });
const a = (id: string, content = id): Msg => ({ id, role: "assistant", content });
const run = (state: TurnState, ...actions: TurnAction[]) => actions.reduce(turnReducer, state);
const start = () => initialTurnState({ messages: [u("u1"), a("a1")], conversationId: "c", needsKey: false });

describe("initialTurnState", () => {
  it("beginnt ruhig; der Key-Hinweis kommt aus dem Server-Check", () => {
    expect(initialTurnState({ needsKey: true })).toMatchObject({
      messages: [],
      input: "",
      loading: false,
      pending: null,
      justFinished: false,
      keyRequired: true,
      consentRequired: false,
    });
    expect(initialTurnState({ needsKey: false }).keyRequired).toBe(false);
  });
});

describe("Beginn und Ende eines Zugs", () => {
  it("started setzt den neuen Verlauf und räumt alles vom letzten Zug weg", () => {
    const dirty: TurnState = {
      ...start(),
      error: "alt",
      retryAfter: 9,
      persistWarning: "alt",
      pending: { text: "x", complete: true },
      justFinished: true,
      retrying: true,
    };
    const next = [u("u1"), a("a1"), u("u2")];
    expect(run(dirty, { type: "started", next })).toMatchObject({
      messages: next,
      error: null,
      retryAfter: null,
      persistWarning: null,
      pending: null,
      justFinished: false,
      retrying: false,
      loading: true,
    });
  });

  it("finished beendet nur die Anfrage; ein ausstehender Text bleibt", () => {
    const state = run(start(), { type: "started", next: [u("u2")] }, { type: "completed", text: "Fertig" }, { type: "finished" });
    expect(state).toMatchObject({ loading: false, retrying: false, pending: { text: "Fertig", complete: true } });
  });
});

describe("Strom", () => {
  it("delta zeigt den bisherigen Text und nimmt den Wartehinweis weg", () => {
    const state = run(start(), { type: "retrying" }, { type: "delta", text: "Hal" });
    expect(state).toMatchObject({ retrying: false, pending: { text: "Hal", complete: false } });
  });

  it("completed schließt den Text ab, ohne ihn schon zur Nachricht zu machen", () => {
    const state = run(start(), { type: "delta", text: "Hallo" }, { type: "completed", text: "Hallo" });
    expect(state.pending).toEqual({ text: "Hallo", complete: true });
    expect(state.messages).toHaveLength(2);
  });

  it("die optimistische Frage bekommt ihre echte ID, andere Nachrichten bleiben", () => {
    const state = run(
      { ...start(), messages: [u("u1"), a("a1"), u("opt")] },
      { type: "userMessageIdReplaced", from: "opt", to: "echt" }
    );
    expect(state.messages.map((m) => m.id)).toEqual(["u1", "a1", "echt"]);
  });

  it("conversationAdopted und persistWarned setzen genau ihr Feld", () => {
    const state = run(
      initialTurnState({ needsKey: false }),
      { type: "conversationAdopted", id: "neu" },
      { type: "persistWarned", message: "Warnung" }
    );
    expect(state).toMatchObject({ conversationId: "neu", persistWarning: "Warnung", error: null });
  });
});

describe("Antwort übernehmen", () => {
  it("replyCommitted hängt die Antwort an; eine Feier nur auf Wunsch", () => {
    const celebrated = run(start(), { type: "replyCommitted", message: a("a2"), celebrate: true });
    expect(celebrated.messages.at(-1)?.id).toBe("a2");
    expect(celebrated.justFinished).toBe(true);

    const quiet = run(start(), { type: "replyCommitted", message: a("a2"), celebrate: false });
    expect(quiet.justFinished).toBe(false);
  });

  it("eine Antwort ohne Feier nimmt eine bestehende Markierung nicht weg", () => {
    const state = run({ ...start(), justFinished: true }, { type: "replyCommitted", message: a("a2"), celebrate: false });
    expect(state.justFinished).toBe(true);
  });

  it("pendingCleared räumt nur den Text weg", () => {
    const state = run(start(), { type: "delta", text: "x" }, { type: "pendingCleared" });
    expect(state.pending).toBeNull();
    expect(state.messages).toHaveLength(2);
  });

  it("reverted stellt den Verlauf vor dem Zug her und räumt den Text weg (Stopp vor dem ersten Wort)", () => {
    const before = [u("u1"), a("a1")];
    const state = run(
      { ...start(), pending: { text: "", complete: false } },
      { type: "started", next: [u("u1")] },
      { type: "reverted", messages: before }
    );
    expect(state).toMatchObject({ messages: before, pending: null });
  });
});

describe("failed", () => {
  const before = [u("u1"), a("a1")];
  const failed = (presentation: Extract<TurnAction, { type: "failed" }>["presentation"]) =>
    run(
      start(),
      { type: "started", next: [...before, u("u2", "meine frage")] },
      { type: "delta", text: "halb" },
      { type: "failed", before, input: "meine frage", presentation }
    );

  it("nimmt die Frage aus dem Verlauf, setzt sie ins Eingabefeld zurück und zeigt die Meldung mit Wartezeit", () => {
    expect(failed({ kind: "error", message: "Zu viele", retryAfter: 30 })).toMatchObject({
      messages: before,
      input: "meine frage",
      pending: null,
      error: "Zu viele",
      retryAfter: 30,
      keyRequired: false,
      consentRequired: false,
    });
  });

  it("byokRequired zeigt den Key-Hinweis statt eines Fehlers", () => {
    expect(failed({ kind: "keyRequired" })).toMatchObject({ keyRequired: true, error: null, input: "meine frage" });
  });

  it("consentRequired zeigt den Zustimmungs-Hinweis statt eines Fehlers", () => {
    expect(failed({ kind: "consentRequired" })).toMatchObject({ consentRequired: true, error: null });
  });
});

describe("Hinweise", () => {
  it("lassen sich wegklicken", () => {
    const state = run(
      { ...start(), keyRequired: true, consentRequired: true },
      { type: "keyNoticeDismissed" },
      { type: "consentNoticeDismissed" }
    );
    expect(state).toMatchObject({ keyRequired: false, consentRequired: false });
  });

  it("inputChanged setzt das Eingabefeld", () => {
    expect(run(start(), { type: "inputChanged", value: "Hi" }).input).toBe("Hi");
  });
});

describe("Gratis-Rahmen", () => {
  const trial = (left: number) => initialTurnState({ needsKey: false, freePromptsLeft: left });

  it("übernimmt den neuen Stand aus done und zeigt bei 0 den Key-Hinweis", () => {
    expect(run(trial(3), { type: "freePromptsUpdated", left: 2 })).toMatchObject({ freePromptsLeft: 2, keyRequired: false });
    expect(run(trial(1), { type: "freePromptsUpdated", left: 0 })).toMatchObject({ freePromptsLeft: 0, keyRequired: true });
  });

  it("ein abgelehnter Zug wegen leerem Tagesbudget zeigt den Key-Hinweis mit Grund", () => {
    const next = run(trial(2), {
      type: "failed",
      before: [],
      input: "Idee",
      presentation: { kind: "keyRequired", reason: "heute aufgebraucht" },
    });
    expect(next).toMatchObject({ keyRequired: true, keyNoticeReason: "heute aufgebraucht", freePromptsLeft: null, input: "Idee" });
  });

  it("ein verbundener Key beendet den Rahmen in der Anzeige", () => {
    expect(run(trial(2), { type: "keyNoticeDismissed" })).toMatchObject({ freePromptsLeft: null, keyNoticeReason: null });
  });
});
