"use client";

import "client-only";

import { useCallback, useEffect, useRef, useState } from "react";

// The Web Speech API is not in TypeScript's DOM lib (it's never left draft
// status), so the surface this file actually touches is declared here rather
// than pulling in a dependency for four interfaces.
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Brave ships the same `webkitSpeechRecognition` constructor as any other
 * Chromium browser, so `speechRecognitionSupported()` passes — but Brave has
 * no working path to Google's recognition backend, so every session fails
 * immediately with a "network" error, even with mic access granted and
 * everything else online. Detected via Brave's own `navigator.brave`, purely
 * to pick an honest error message: this is a permanent browser limitation,
 * not a transient connectivity problem, so "try again" would never help.
 */
type BraveNavigator = Navigator & { brave?: { isBrave: () => Promise<boolean> } };
let braveDetection: Promise<boolean> | null = null;
function isBrave(): Promise<boolean> {
  if (typeof navigator === "undefined") return Promise.resolve(false);
  const brave = (navigator as BraveNavigator).brave;
  if (!brave) return Promise.resolve(false);
  if (!braveDetection) braveDetection = brave.isBrave().catch(() => false);
  return braveDetection;
}

/** True when this browser can transcribe at all (Chrome, Edge, Safari 14.1+). */
export function speechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export type Transcript = {
  /** Everything the engine has committed and won't revise. */
  final: string;
  /** The words still in flight — what makes the transcript update as you speak. */
  interim: string;
};

/**
 * Live dictation, wrapped so the component only sees `{ final, interim }`.
 *
 * ⚠️ Privacy, and the reason this is worth a second look before shipping: in
 * Chrome and Edge this API is not on-device. The browser streams the captured
 * audio to the vendor's own speech service and returns text. That makes the
 * browser vendor an additional processor for anything spoken here, which is not
 * currently named in the Datenschutzerklärung (src/app/datenschutz) — that page
 * lists Z.ai, Gemini and Supabase. Safari transcribes on-device for short
 * utterances. Nothing about this is hidden from the user by the browser (the
 * recording indicator is on), but the privacy page needs a line before this
 * goes live.
 *
 * `interimResults` is what produces the word-by-word effect: the engine emits a
 * growing best guess for the current utterance, then replaces it with a final
 * result once the phrase settles.
 */
/** Warum die Erkennung nicht läuft, als Code; den Text wählt VoiceBar (t.voice.errors). */
export type SpeechError =
  | "sttNotAllowed"
  | "sttBrave"
  | "sttUnavailable"
  | "sttAborted"
  | "sttStartFailed";

export function useSpeechRecognition({
  active,
  lang = "de-DE",
  onFinalPhrase,
}: {
  active: boolean;
  lang?: string;
  /** Fires once per phrase the engine commits, for callers that want to react as it goes. */
  onFinalPhrase?: (text: string) => void;
}): Transcript & { supported: boolean; error: SpeechError | null; reset: () => void } {
  const [final, setFinal] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<SpeechError | null>(null);
  const supported = useRef(speechRecognitionSupported()).current;

  // Held in a ref so changing the callback doesn't tear down and restart the
  // recogniser mid-sentence (restarting drops the utterance in progress).
  const onFinalRef = useRef(onFinalPhrase);
  useEffect(() => {
    onFinalRef.current = onFinalPhrase;
  }, [onFinalPhrase]);

  const reset = useCallback(() => {
    setFinal("");
    setInterim("");
  }, []);

  useEffect(() => {
    if (!active || !supported) return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    // A previous session may have failed with "not-allowed"; that message must
    // not outlive the attempt it describes, or granting the permission and
    // reopening still shows "Ich darf nicht mithören" forever.
    setError(null);

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    // Gesetzt, wenn die Sitzung nicht weiterlaufen soll: beim Abbau und nach einem Fehler, der beim nächsten Versuch
    // wiederkäme. Sonst startet `onend` neu: Chrome beendet die Sitzung nach einer Weile Stille auch mit
    // `continuous = true`, und ohne Neustart bliebe das Mikrofon offen, während die Erkennung still aufgehört hat.
    let stopping = false;

    recognition.onresult = (event) => {
      let committed = "";
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) committed += text;
        else pending += text;
      }
      if (committed) {
        setFinal((prev) => (prev ? `${prev} ${committed.trim()}` : committed.trim()));
        onFinalRef.current?.(committed.trim());
      }
      setInterim(pending.trim());
    };

    recognition.onerror = (event) => {
      // "no-speech" and "aborted" are routine (a pause, or our own stop) and
      // must not surface as failures — showing an error every time someone
      // thinks for two seconds is worse than showing nothing.
      if (event.error === "no-speech" || event.error === "aborted") return;
      // Alles andere käme beim nächsten Versuch wieder (kein Recht, kein Dienst, kein Mikrofon, Sprache fehlt): ein
      // Neustart in `onend` liefe Start, Fehler, Ende, Start ohne Pause, bis die Leiste zugeht (#423). Die Sitzung
      // endet hier, `error` sagt warum; erst das nächste Zuhören versucht es wieder.
      stopping = true;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("sttNotAllowed");
      } else if (event.error === "network") {
        void isBrave().then((brave) => {
          setError(brave ? "sttBrave" : "sttUnavailable");
        });
      } else {
        setError("sttAborted");
      }
    };

    recognition.onend = () => {
      if (stopping) return;
      // Timed out on its own while we still want to listen: start a new
      // session. Wrapped because calling start() on an instance that hasn't
      // finished ending throws InvalidStateError.
      try {
        recognition.start();
      } catch {
        /* already restarting, nothing to do */
      }
    };

    try {
      recognition.start();
    } catch {
      setError("sttStartFailed");
    }

    return () => {
      stopping = true;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      // abort(), not stop(): stop() asks for one last final result, which lands
      // after unmount and updates state on a dead component.
      recognition.abort();
    };
  }, [active, lang, supported]);

  return { final, interim, supported, error, reset };
}
