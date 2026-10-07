import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_USER_MESSAGE_CHARS } from "@/shared/lib/chat-limits";
import { VoiceBar } from "./voice-bar";

// Charakterisierungstests (Betriebs-Audit, Folgesitzung 2026-10-07, Teil E): halten das
// Verhalten der Sprachleiste fest, BEVOR voice-bar.tsx unter die 400-Zeilen-Grenze zerlegt wird
// (pickVoice und WordStream in eigene Dateien). Sie rufen nur die öffentliche Fläche
// (<VoiceBar>) und müssen vor und nach dem Schnitt unverändert laufen.
//
// Mikrofon, Spracherkennung, Zeichenfläche und Sprachausgabe gibt es in jsdom nicht: die drei
// Hooks und die Wellenform sind ersetzt, speechSynthesis und SpeechSynthesisUtterance sind
// Attrappen, deren Aufrufe der Test liest.

const speech = { final: "", interim: "", supported: true, error: null as string | null, reset: vi.fn() };

vi.mock("@/features/chat/hooks/use-mic-analyser", () => ({
  useMicAnalyser: () => ({ status: "live", error: null, readHalf: () => 0 }),
}));
vi.mock("@/features/chat/hooks/use-speech-recognition", () => ({
  useSpeechRecognition: () => speech,
}));
vi.mock("@/features/chat/hooks/use-visual-viewport-inset", () => ({
  useVisualViewportInset: () => 0,
}));
// Die Wellenform bekommt ihre Energie über eine Ref, die die Leiste Bild für Bild nachführt: die
// Attrappe hält sie fest, damit der Test sie lesen kann.
const waveform = vi.hoisted(() => ({ energyRef: null as { current: number } | null, mode: "" }));
vi.mock("@/features/chat/components/voice-waveform", () => ({
  VoiceWaveform: ({ energyRef, mode }: { energyRef: { current: number }; mode: string }) => {
    waveform.energyRef = energyRef;
    waveform.mode = mode;
    return null;
  },
}));
// Finns Pose ist der Zustandsanzeiger (kein Text daneben): die Attrappe legt den `state` offen.
vi.mock("@/shared/brand/animated-mascot", () => ({
  AnimatedMascot: ({ state }: { state: string }) => <span data-testid="mascot" data-state={state} />,
}));

class FakeUtterance {
  text: string;
  lang = "";
  voice: unknown = null;
  rate = 1;
  pitch = 1;
  onboundary: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

const synth = {
  speak: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn((): unknown[] => []),
};

const voice = (lang: string, localService: boolean) => ({ lang, localService, name: `${lang}-${localService}` });

beforeEach(() => {
  speech.final = "";
  speech.interim = "";
  speech.supported = true;
  speech.error = null;
  speech.reset.mockReset();
  synth.speak.mockReset();
  synth.cancel.mockReset();
  synth.getVoices.mockReset().mockReturnValue([]);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true, writable: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Der Haken rechts: "Absenden" beim Zuhören, "Überspringen" beim Sprechen. */
const primary = () => screen.getByRole("button", { name: /Absenden|Überspringen/ });
const status = () => document.querySelector('[aria-live="polite"]')?.textContent;
const pose = () => screen.getByTestId("mascot").getAttribute("data-state");
const spokenUtterance = () => synth.speak.mock.calls[0]?.[0] as FakeUtterance;

/** Rendert, sendet per Haken und wartet, bis die Antwort da ist (Vorlesen beginnt). */
async function sendAndAnswer(answer: string | null, props: { lang?: string } = {}) {
  const onSubmit = vi.fn(async () => answer);
  const onClose = vi.fn();
  render(<VoiceBar onClose={onClose} onSubmit={onSubmit} {...props} />);
  await act(async () => {
    fireEvent.click(primary());
  });
  return { onSubmit, onClose };
}

describe("Auto-Senden", () => {
  it("schickt einen fertigen Satz nach 1,5 s Stille hinaus, nicht früher", async () => {
    vi.useFakeTimers();
    speech.final = "Hallo Finn";
    const onSubmit = vi.fn(async () => "ok");
    render(<VoiceBar onClose={vi.fn()} onSubmit={onSubmit} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1499);
    });
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("Hallo Finn");
  });

  it("schickt den Satz getrimmt hinaus (Leerraum und Zeilenumbrüche der Erkennung bleiben draussen)", async () => {
    vi.useFakeTimers();
    speech.final = "  Hallo Finn \n";
    const onSubmit = vi.fn(async () => "ok");
    render(<VoiceBar onClose={vi.fn()} onSubmit={onSubmit} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(onSubmit).toHaveBeenCalledWith("Hallo Finn");
  });

  it("sendet nicht ein zweites Mal, solange die Antwort noch aussteht (Nachdenken), auch wenn der Text stehen bleibt", async () => {
    vi.useFakeTimers();
    speech.final = "Hallo";
    const onSubmit = vi.fn(() => new Promise<string>(() => {})); // antwortet nie
    render(<VoiceBar onClose={vi.fn()} onSubmit={onSubmit} />);

    await act(async () => {
      fireEvent.click(primary()); // vor Ablauf der 1,5 s
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("wartet, solange noch eine Phrase entsteht (interim), und sendet bei leerem Text nie", async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn(async () => "ok");
    speech.final = "Hallo";
    speech.interim = "Fi";
    const { unmount } = render(<VoiceBar onClose={vi.fn()} onSubmit={onSubmit} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(onSubmit).not.toHaveBeenCalled();
    unmount();

    speech.final = "   ";
    speech.interim = "";
    render(<VoiceBar onClose={vi.fn()} onSubmit={onSubmit} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("Haken (Absenden, Überspringen)", () => {
  it("ist gesperrt, solange nichts gesprochen wurde, und sendet sonst sofort", async () => {
    render(<VoiceBar onClose={vi.fn()} onSubmit={vi.fn(async () => "ok")} />);
    expect(primary()).toBeDisabled();
    expect(primary()).toHaveAttribute("aria-label", "Absenden");
  });

  it("sendet mit gesprochenem Text, getrimmt und auf die Grenze einer Nachricht gekürzt", async () => {
    speech.final = `  ${"a".repeat(MAX_USER_MESSAGE_CHARS + 500)}  `;
    const onSubmit = vi.fn(async () => "ok");
    render(<VoiceBar onClose={vi.fn()} onSubmit={onSubmit} />);

    await act(async () => {
      fireEvent.click(primary());
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const sent = (onSubmit.mock.calls[0] as unknown as [string])[0];
    expect(sent).toHaveLength(MAX_USER_MESSAGE_CHARS);
    expect(sent.startsWith("a")).toBe(true);
  });

  it("sendet final und interim zusammen, wenn man den Haken drückt", async () => {
    speech.final = "Baue mir";
    speech.interim = "eine App";
    const onSubmit = vi.fn(async () => "ok");
    render(<VoiceBar onClose={vi.fn()} onSubmit={onSubmit} />);
    await act(async () => {
      fireEvent.click(primary());
    });
    expect(onSubmit).toHaveBeenCalledWith("Baue mir eine App");
  });
});

describe("Zustandsschleife und Vorlesen", () => {
  it("läuft Zuhören → Nachdenken → Sprechen → Zuhören und meldet jeden Zustand im Live-Bereich", async () => {
    speech.final = "Hallo";
    let resolveAnswer: (value: string) => void = () => {};
    const onSubmit = vi.fn(() => new Promise<string>((resolve) => (resolveAnswer = resolve)));
    render(<VoiceBar onClose={vi.fn()} onSubmit={onSubmit} />);
    expect(status()).toBe("Ich höre zu.");
    expect(pose()).toBe("listening");

    await act(async () => {
      fireEvent.click(primary());
    });
    expect(status()).toBe("Finn denkt nach.");
    expect(pose()).toBe("thinking");
    expect(primary()).toBeDisabled();
    // Der gesprochene Text bleibt stehen, bis die Antwort da ist (reset() leert ihn danach).
    expect(screen.getByText("Hallo")).toBeInTheDocument();

    await act(async () => {
      resolveAnswer("Das ist die Antwort.");
    });
    expect(status()).toBe("Finn spricht.");
    expect(pose()).toBe("explaining");
    expect(primary()).toHaveAttribute("aria-label", "Überspringen");
    expect(speech.reset).toHaveBeenCalled();
    expect(screen.getByText("Das ist die Antwort.")).toBeInTheDocument();

    act(() => {
      spokenUtterance().onend?.();
    });
    expect(status()).toBe("Ich höre zu.");
  });

  it("liest die Antwort in der App-Sprache vor, mit festem Tempo und fester Tonhöhe, nach cancel()", async () => {
    speech.final = "Hallo";
    await sendAndAnswer("Antwort");

    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    const utterance = spokenUtterance();
    expect(utterance.text).toBe("Antwort");
    expect(utterance.lang).toBe("de-DE");
    expect(utterance.rate).toBe(1.02);
    expect(utterance.pitch).toBe(1.02);
  });

  it("nimmt eine mitgegebene Sprache statt der der App", async () => {
    speech.final = "Hallo";
    await sendAndAnswer("Answer", { lang: "en-GB" });
    expect(spokenUtterance().lang).toBe("en-GB");
  });

  it("liest keinen Codeblock vor, sondern sagt, dass der Prompt aufgeschrieben ist", async () => {
    speech.final = "Hallo";
    await sendAndAnswer("Vorher.\n```ts\nconst geheim = 1;\n```\nNachher.");
    expect(spokenUtterance().text).toBe("Vorher.\n … den fertigen Prompt hab ich dir aufgeschrieben. \nNachher.");
    expect(spokenUtterance().text).not.toContain("geheim");
  });

  it("liest höchstens 4000 Zeichen vor", async () => {
    speech.final = "Hallo";
    await sendAndAnswer("x".repeat(6000));
    expect(spokenUtterance().text).toHaveLength(4000);
  });

  it("bleibt beim Zuhören, wenn der Browser nicht sprechen kann", async () => {
    Object.defineProperty(window, "speechSynthesis", { value: undefined, configurable: true, writable: true });
    speech.final = "Hallo";
    await sendAndAnswer("Antwort");
    expect(synth.speak).not.toHaveBeenCalled();
    expect(status()).toBe("Ich höre zu.");
  });

  it("der Haken überspringt das Vorlesen: cancel() und zurück ins Zuhören", async () => {
    speech.final = "Hallo";
    await sendAndAnswer("Antwort");
    expect(status()).toBe("Finn spricht.");
    synth.cancel.mockClear();

    fireEvent.click(primary());

    expect(synth.cancel).toHaveBeenCalled();
    expect(status()).toBe("Ich höre zu.");
  });

  it("ein Fehler der Sprachausgabe führt ebenfalls zurück ins Zuhören", async () => {
    speech.final = "Hallo";
    await sendAndAnswer("Antwort");
    act(() => {
      spokenUtterance().onerror?.();
    });
    expect(status()).toBe("Ich höre zu.");
  });

  it("Wortgrenzen der Sprachausgabe laufen ohne Absturz durch", async () => {
    speech.final = "Hallo";
    await sendAndAnswer("Antwort");
    expect(() => spokenUtterance().onboundary?.()).not.toThrow();
  });
});

// Die Energie, die die Wellenform liest, führt die Leiste in jedem Bild nach (kein React-Zustand, sie
// ändert sich pro Bild): Zuhören 0, Nachdenken ein stetiges Summen, Sprechen ein Impuls je Wort, der
// zum Boden zurückfällt.
describe("Wellen-Energie", () => {
  const energy = () => waveform.energyRef!.current;
  const frames = async (ms: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };

  async function renderSpeaking() {
    vi.useFakeTimers();
    speech.final = "Hallo";
    let resolveAnswer: (value: string) => void = () => {};
    const onSubmit = vi.fn(() => new Promise<string>((resolve) => (resolveAnswer = resolve)));
    render(<VoiceBar onClose={vi.fn()} onSubmit={onSubmit} />);
    await act(async () => {
      fireEvent.click(primary());
    });
    return async () => {
      await act(async () => {
        resolveAnswer("Antwort");
      });
    };
  }

  it("Zuhören 0, Nachdenken 0,62, Sprechen mindestens 0,42, danach wieder 0", async () => {
    vi.useFakeTimers();
    speech.final = "Hallo";
    let resolveAnswer: (value: string) => void = () => {};
    render(<VoiceBar onClose={vi.fn()} onSubmit={vi.fn(() => new Promise<string>((r) => (resolveAnswer = r)))} />);

    await frames(100);
    expect(energy()).toBe(0);

    await act(async () => {
      fireEvent.click(primary());
    });
    await frames(100);
    expect(energy()).toBe(0.62);

    await act(async () => {
      resolveAnswer("Antwort");
    });
    await frames(3000);
    expect(energy()).toBeCloseTo(0.42, 5);

    act(() => {
      spokenUtterance().onend?.();
    });
    await frames(100);
    expect(energy()).toBe(0);
  });

  it("jedes gesprochene Wort stösst die Welle an (bis 1), dann fällt sie auf den Boden zurück", async () => {
    const answer = await renderSpeaking();
    await answer();
    await frames(3000);
    expect(energy()).toBeCloseTo(0.42, 5);

    act(() => {
      spokenUtterance().onboundary?.();
    });
    await frames(17);
    expect(energy()).toBeGreaterThan(0.9);

    // Nach etwa 150 ms ist die Energie um rund 1,9 je Sekunde gefallen (nicht schneller, nicht langsamer).
    await frames(150);
    expect(energy()).toBeGreaterThan(0.62);
    expect(energy()).toBeLessThan(0.85);

    await frames(3000);
    expect(energy()).toBeCloseTo(0.42, 5);
  });
});

describe("Stimme wählen (pickVoice)", () => {
  async function chosenVoice(voices: unknown[], lang?: string) {
    synth.getVoices.mockReturnValue(voices);
    speech.final = "Hallo";
    await sendAndAnswer("Antwort", lang ? { lang } : {});
    return spokenUtterance().voice;
  }

  it("nimmt eine Stimme der Sprache, am liebsten eine auf dem Gerät", async () => {
    const onDevice = voice("de-CH", true);
    expect(await chosenVoice([voice("en-US", true), voice("de-DE", false), onDevice])).toBe(onDevice);
  });

  it("nimmt sonst irgendeine Stimme der Sprache", async () => {
    const remote = voice("de-DE", false);
    expect(await chosenVoice([voice("en-US", true), remote])).toBe(remote);
  });

  it("vergleicht nur den Sprachteil, ohne Rücksicht auf Groß- und Kleinschreibung (auf beiden Seiten)", async () => {
    const french = voice("FR-ca", true);
    expect(await chosenVoice([voice("de-DE", true), french], "fr-FR")).toBe(french);
  });

  it("auch wenn die mitgegebene Sprache grossgeschrieben ist", async () => {
    const french = voice("fr-CA", true);
    expect(await chosenVoice([voice("de-DE", true), french], "FR-fr")).toBe(french);
  });

  it("lässt die Stimme des Browsers stehen, wenn keine passt", async () => {
    expect(await chosenVoice([voice("en-US", true)])).toBeNull();
  });

  it("lässt die Stimme des Browsers stehen, wenn gar keine da ist", async () => {
    expect(await chosenVoice([])).toBeNull();
  });
});

describe("Fehler beim Senden", () => {
  it("eine leere Antwort zeigt den Hinweis und geht zurück ins Zuhören, ohne vorzulesen", async () => {
    speech.final = "Hallo";
    await sendAndAnswer("   ");
    expect(screen.getByText("Da kam nichts zurück. Sag es nochmal, oder tipp es.")).toBeInTheDocument();
    expect(synth.speak).not.toHaveBeenCalled();
    expect(status()).toBe("Ich höre zu.");
  });

  it("eine fehlende Antwort (null) wie eine leere", async () => {
    speech.final = "Hallo";
    await sendAndAnswer(null);
    expect(screen.getByText("Da kam nichts zurück. Sag es nochmal, oder tipp es.")).toBeInTheDocument();
  });

  it("ein abgelehntes Senden zeigt den Fehlerhinweis und geht zurück ins Zuhören", async () => {
    speech.final = "Hallo";
    const onSubmit = vi.fn(async () => {
      throw new Error("netz");
    });
    render(<VoiceBar onClose={vi.fn()} onSubmit={onSubmit} />);
    await act(async () => {
      fireEvent.click(primary());
    });
    expect(screen.getByText("Das hat nicht geklappt. Sag es nochmal, oder tipp es.")).toBeInTheDocument();
    expect(status()).toBe("Ich höre zu.");
    expect(speech.reset).toHaveBeenCalled();
  });

  it("zeigt Hardware- und Erkennungsfehler anstelle des Textes, und der Browser-Hinweis hat Vorrang", () => {
    speech.error = "micDenied";
    const { unmount } = render(<VoiceBar onClose={vi.fn()} onSubmit={vi.fn(async () => null)} />);
    expect(screen.getByText(/Ich brauche Zugriff auf dein Mikrofon/)).toBeInTheDocument();
    unmount();

    speech.supported = false;
    render(<VoiceBar onClose={vi.fn()} onSubmit={vi.fn(async () => null)} />);
    expect(screen.getByText(/kann noch nicht mithören/)).toBeInTheDocument();
    expect(screen.queryByText(/Ich brauche Zugriff/)).not.toBeInTheDocument();
  });
});

describe("Schliessen", () => {
  it("der Knopf links und Escape schliessen und brechen das Vorlesen ab", () => {
    const onClose = vi.fn();
    render(<VoiceBar onClose={onClose} onSubmit={vi.fn(async () => null)} />);

    fireEvent.click(screen.getByRole("button", { name: "Sprachmodus schliessen" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(synth.cancel).toHaveBeenCalled();

    synth.cancel.mockClear();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(synth.cancel).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("beim Abbau wird die Sprachausgabe gestoppt (sie überlebt die Komponente sonst)", () => {
    const { unmount } = render(<VoiceBar onClose={vi.fn()} onSubmit={vi.fn(async () => null)} />);
    synth.cancel.mockClear();
    unmount();
    expect(synth.cancel).toHaveBeenCalled();
  });
});

describe("Mitschrift (WordStream)", () => {
  it("zeigt jedes Wort einzeln, fertige Wörter fest und die entstehende Phrase gedämpft", () => {
    speech.final = "Baue mir eine";
    speech.interim = "schöne App";
    render(<VoiceBar onClose={vi.fn()} onSubmit={vi.fn(async () => null)} />);

    for (const word of ["Baue", "mir", "eine", "schöne", "App"]) {
      expect(screen.getByText(word).tagName).toBe("SPAN");
      expect(screen.getByText(word)).toHaveClass("mr-[0.26em]", "inline-block");
    }
    expect(screen.getByText("Baue").parentElement).toHaveClass("text-foreground");
    expect(screen.getByText("schöne").parentElement).toHaveClass("text-secondary");
  });

  it("ohne gesprochenen Text steht die Aufforderung", () => {
    render(<VoiceBar onClose={vi.fn()} onSubmit={vi.fn(async () => null)} />);
    expect(screen.getByText("Sag einfach, was du bauen willst.")).toBeInTheDocument();
  });

  it("beim Sprechen steht die Antwort statt der Mitschrift", async () => {
    speech.final = "Hallo";
    await sendAndAnswer("Die Antwort steht da.");
    expect(screen.getByText("Die Antwort steht da.")).toBeInTheDocument();
    expect(screen.queryByText("Hallo")).not.toBeInTheDocument();
  });

  it("nach dem Vorlesen zeigt die Leiste wieder die neue Mitschrift, nicht die alte Antwort", async () => {
    speech.final = "Hallo";
    await sendAndAnswer("Die alte Antwort.");

    speech.final = "Neuer Satz";
    act(() => {
      spokenUtterance().onend?.();
    });

    expect(screen.getByText("Neuer")).toBeInTheDocument();
    expect(screen.queryByText("Die alte Antwort.")).not.toBeInTheDocument();
  });

  it("sonst bricht er mehrere Leerzeichen und Zeilenumbrüche zu einzelnen Wörtern auf", () => {
    speech.final = "eins   zwei\nDrei";
    render(<VoiceBar onClose={vi.fn()} onSubmit={vi.fn(async () => null)} />);
    expect(screen.getAllByText(/^(eins|zwei|Drei)$/)).toHaveLength(3);
  });
});
