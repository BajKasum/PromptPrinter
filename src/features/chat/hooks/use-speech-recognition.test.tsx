import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSpeechRecognition } from "./use-speech-recognition";

// Die Erkennung gegen eine nachgebaute SpeechRecognition, nie gegen ein echtes Mikrofon. Wie im Browser kommt, was
// nach start() geschieht (ein Fehler, danach das Ende), erst einen Takt später; der Test gibt es je Versuch vor und
// zählt die Versuche.

type Script = (recognition: FakeRecognition, attempt: number) => void;

let script: Script = () => {};
let created: FakeRecognition[] = [];

class FakeRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  maxAlternatives = 1;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  starts = 0;
  aborted = false;

  constructor() {
    created.push(this);
  }
  start() {
    this.starts += 1;
    const attempt = this.starts;
    setTimeout(() => script(this, attempt), 0);
  }
  stop() {}
  abort() {
    this.aborted = true;
  }
  /** Was der Browser nach einem Fehler tut: erst `error`, dann `end`. */
  fail(error: string) {
    this.onerror?.({ error });
    this.onend?.();
  }
  /** Das stille Zeitlimit: die Sitzung endet von selbst, ohne Fehler. */
  end() {
    this.onend?.();
  }
}

/** Lässt die Takte laufen, in denen ein Neustart käme (die Attrappe antwortet mit setTimeout 0). */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 30)));

beforeEach(() => {
  created = [];
  script = () => {};
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "brave");
});

describe("ein Fehler, der beim nächsten Versuch wiederkäme (#423)", () => {
  it.each([
    ["not-allowed", "sttNotAllowed"],
    ["service-not-allowed", "sttNotAllowed"],
    ["network", "sttUnavailable"],
    ["audio-capture", "sttAborted"],
    ["language-not-supported", "sttAborted"],
  ])("nach %s startet sie nicht neu und meldet %s", async (code, expected) => {
    script = (recognition) => recognition.fail(code);
    const { result } = renderHook(() => useSpeechRecognition({ active: true }));

    await waitFor(() => expect(result.current.error).toBe(expected));
    await settle();

    expect(created).toHaveLength(1);
    expect(created[0].starts).toBe(1);
  });

  it("in Brave scheitert sie mit network: einmal, mit dem Hinweis auf Brave", async () => {
    const isBrave = vi.fn(async () => true);
    Object.defineProperty(navigator, "brave", { value: { isBrave }, configurable: true });
    script = (recognition) => recognition.fail("network");
    const { result } = renderHook(() => useSpeechRecognition({ active: true }));

    await waitFor(() => expect(result.current.error).toBe("sttBrave"));
    await settle();

    expect(created[0].starts).toBe(1);
  });

  it("beim nächsten Zuhören (nach einem Zug) versucht sie es genau einmal wieder", async () => {
    script = (recognition) => recognition.fail("network");
    const { result, rerender } = renderHook(({ active }) => useSpeechRecognition({ active }), {
      initialProps: { active: true },
    });
    await waitFor(() => expect(result.current.error).toBe("sttUnavailable"));

    rerender({ active: false });
    rerender({ active: true });
    await waitFor(() => expect(created).toHaveLength(2));
    await waitFor(() => expect(result.current.error).toBe("sttUnavailable"));
    await settle();

    expect(created.map((recognition) => recognition.starts)).toEqual([1, 1]);
  });
});

describe("ein gewöhnliches Ende", () => {
  it("nach dem stillen Zeitlimit startet sie neu, ohne Hinweis", async () => {
    script = (recognition, attempt) => {
      if (attempt === 1) recognition.end();
    };
    const { result } = renderHook(() => useSpeechRecognition({ active: true }));

    await waitFor(() => expect(created[0].starts).toBe(2));
    expect(result.current.error).toBeNull();
  });

  it("nach no-speech (eine Pause) startet sie neu, ohne Hinweis", async () => {
    script = (recognition, attempt) => {
      if (attempt === 1) recognition.fail("no-speech");
    };
    const { result } = renderHook(() => useSpeechRecognition({ active: true }));

    await waitFor(() => expect(created[0].starts).toBe(2));
    expect(result.current.error).toBeNull();
  });

  it("nach dem Abbau startet sie nicht neu und bricht ab", async () => {
    const { unmount } = renderHook(() => useSpeechRecognition({ active: true }));
    unmount();

    created[0].end();
    await settle();

    expect(created[0].aborted).toBe(true);
    expect(created[0].starts).toBe(1);
  });
});
