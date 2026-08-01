"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, SkipForward, X } from "lucide-react";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import type { MascotState } from "@/components/brand/mascot-states";
import { VoiceWaveform, type VoiceMode } from "@/components/app/voice-waveform";
import { useMicAnalyser } from "@/lib/use-mic-analyser";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { MAX_USER_MESSAGE_CHARS } from "@/lib/chat-limits";
import { useVisualViewportInset } from "@/lib/use-visual-viewport-inset";

/** Silence after a committed phrase before the turn is sent on its own. */
const AUTO_SEND_SILENCE_MS = 1500;

/** The bar has no "paused" state (no mute control, see below), only the loop. */
type SpokenMode = Extract<VoiceMode, "listening" | "thinking" | "speaking">;

const MASCOT_FOR_MODE: Record<SpokenMode, MascotState> = {
  listening: "listening",
  thinking: "thinking",
  speaking: "explaining",
};

/** Screen-reader-only equivalent of what the mascot pose + waveform motion show sighted users. */
const STATUS_FOR_MODE: Record<SpokenMode, string> = {
  listening: "Ich höre zu.",
  thinking: "Finn denkt nach.",
  speaking: "Finn spricht.",
};

/** Picks a German voice if the platform has one, else whatever is default. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith("de") && v.localService) ??
    voices.find((v) => v.lang.toLowerCase().startsWith("de")) ??
    null
  );
}

/**
 * The voice bar: recording happens inline, right where the composer normally
 * sits. Unlike the fullscreen voice mode this replaces, the transcript above
 * stays visible and scrollable the whole time — this is a mode of the
 * composer, not a separate screen.
 *
 * The three states are a loop — listening → thinking → speaking → listening —
 * and each one owns different hardware:
 *
 *   listening  mic analyser drives the waveform, recogniser builds the
 *              transcript, a pause of AUTO_SEND_SILENCE_MS sends the turn
 *   thinking   recogniser off (it must not transcribe Finn), request in flight
 *   speaking   speech synthesis reads the reply; its word-boundary events push
 *              the waveform, since the API exposes no audio to analyse
 *
 * State is communicated only through Finn's pose and the waveform's motion
 * (see MASCOT_FOR_MODE and VoiceWaveform's per-mode "feel") rather than a
 * status label — STATUS_FOR_MODE exists purely for the sr-only live region.
 */
export function VoiceBar({
  onClose,
  onSubmit,
  lang = "de-DE",
}: {
  onClose: () => void;
  /** Sends the spoken turn and resolves with Finn's reply (null if it failed). */
  onSubmit: (text: string) => Promise<string | null>;
  lang?: string;
}) {
  const [mode, setMode] = useState<SpokenMode>("listening");
  const [reply, setReply] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const reducedMotion = useReducedMotion() ?? false;
  // QA finding K-1 (chat-composer.tsx): keeps the bar pinned above an
  // on-screen keyboard rather than floating mid-screen, same as the composer
  // it replaces.
  const keyboardInset = useVisualViewportInset();

  const listening = mode === "listening";
  const mic = useMicAnalyser(true);
  const { final, interim, supported, error: sttError, reset } = useSpeechRecognition({
    active: listening,
    lang,
  });

  // Drive for the synthetic waveform states. Mutated from an animation frame
  // rather than React state: it changes every frame and nothing re-renders on it.
  const energyRef = useRef(0);
  const speechPulseRef = useRef(0);
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Maintains `energyRef`: a decaying impulse per spoken word while Finn talks,
  // a low steady hum while he thinks, nothing otherwise.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const m = modeRef.current;
      if (m === "speaking") {
        // Each word boundary tops this up; between words it falls back towards
        // a floor so the row keeps moving through a long sentence.
        const decayed = energyRef.current - dt * 1.9;
        energyRef.current = Math.max(0.42, Math.min(1, Math.max(decayed, speechPulseRef.current)));
        speechPulseRef.current = Math.max(0, speechPulseRef.current - dt * 3.2);
      } else if (m === "thinking") {
        energyRef.current = 0.62;
      } else {
        energyRef.current = 0;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const spokenText = useMemo(() => `${final} ${interim}`.trim(), [final, interim]);

  // ── sending ─────────────────────────────────────────────────────────────
  // Held in a ref so the silence timer can call the latest version without
  // being torn down and restarted every time a word arrives.
  const submitRef = useRef<(text: string) => void>(() => {});

  const speak = useCallback(
    (text: string) => {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (!synth || !text.trim()) {
        setMode("listening");
        return;
      }
      // Reading a full prompt aloud, code block and all, is unbearable; voice
      // mode answers with the prose and leaves the artefact on screen.
      const spoken = text.replace(/```[\s\S]*?```/g, " … den fertigen Prompt hab ich dir aufgeschrieben. ");
      const utterance = new SpeechSynthesisUtterance(spoken.slice(0, 4000));
      utterance.lang = lang;
      const voice = pickVoice(synth.getVoices());
      if (voice) utterance.voice = voice;
      utterance.rate = 1.02;
      utterance.pitch = 1.02;
      // The only real signal the API gives about its own output. One impulse
      // per word is enough to make the waveform track the rhythm of the speech.
      utterance.onboundary = () => {
        speechPulseRef.current = 1;
      };
      utterance.onend = () => setMode("listening");
      utterance.onerror = () => setMode("listening");
      synth.cancel();
      synth.speak(utterance);
      setMode("speaking");
    },
    [lang]
  );

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim().slice(0, MAX_USER_MESSAGE_CHARS);
      if (!trimmed) return;
      setMode("thinking");
      setSendError(null);
      setReply("");
      void onSubmit(trimmed).then(
        (answer) => {
          reset();
          if (answer && answer.trim()) {
            setReply(answer);
            speak(answer);
          } else {
            setSendError("Da kam nichts zurück. Sag es nochmal, oder tipp es.");
            setMode("listening");
          }
        },
        () => {
          reset();
          setSendError("Das hat nicht geklappt. Sag es nochmal, oder tipp es.");
          setMode("listening");
        }
      );
    },
    [onSubmit, reset, speak]
  );
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  // Auto-send after a pause. Keyed on the transcript itself, so every new word
  // restarts the clock and the turn only goes out once the user has actually
  // stopped talking. `interim` being non-empty means a phrase is still forming,
  // so the timer only runs on settled text.
  useEffect(() => {
    if (mode !== "listening") return;
    if (!final.trim() || interim.trim()) return;
    const t = window.setTimeout(() => submitRef.current(final), AUTO_SEND_SILENCE_MS);
    return () => window.clearTimeout(t);
  }, [final, interim, mode]);

  // ── lifecycle ───────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  const close = useCallback(() => {
    stopSpeaking();
    onClose();
  }, [onClose, stopSpeaking]);

  // The bar is only ever mounted while voice mode is on (chat.tsx swaps it in
  // for the composer), so mount/unmount stands in for open/close: nothing to
  // reset on the way in, but speechSynthesis is global and outlives the
  // component, so it must be told to stop on the way out or Finn keeps
  // talking to a composer that has already gone back to text.
  useEffect(() => stopSpeaking, [stopSpeaking]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [spokenText, reply]);

  const blocker = !supported
    ? "Dieser Browser kann noch nicht mithören. In Chrome, Edge oder Safari funktioniert es."
    : mic.error ?? sttError ?? sendError;

  const primaryDisabled = mode === "thinking" || (mode === "listening" && !spokenText.trim());
  const primaryLabel = mode === "speaking" ? "Überspringen" : "Absenden";
  function primaryAction() {
    if (mode === "speaking") {
      stopSpeaking();
      setMode("listening");
    } else if (mode === "listening") {
      submit(spokenText);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={keyboardInset > 0 ? { bottom: keyboardInset } : undefined}
      className="sticky bottom-0 z-10 -mb-4 bg-gradient-to-t from-background via-background to-background/0 pb-4 pt-5"
    >
      {/* The accessible announcement of the state machine. Sighted users read
          the state off Finn's pose and the waveform instead (see module doc). */}
      <div aria-live="polite" className="sr-only">
        {STATUS_FOR_MODE[mode]}
      </div>

      {/* Live transcript, directly above the bar. Final words are solid, the
          phrase still being recognised stays muted until the engine commits
          it, so you can see it firming up rather than watching text rewrite
          itself. Capped and scrollable rather than growing the sticky footer
          without bound, so a long turn never crowds out the thread above it. */}
      <div ref={transcriptRef} className="mb-2.5 max-h-24 overflow-y-auto px-3 text-center">
        {blocker ? (
          <p className="text-balance text-[13px] leading-relaxed text-warning">{blocker}</p>
        ) : mode === "speaking" && reply ? (
          <p className="text-balance text-[14px] leading-relaxed text-foreground/90">{reply}</p>
        ) : spokenText ? (
          <p className="text-balance text-[16px] leading-[1.5] tracking-[-0.01em] text-foreground">
            <WordStream text={final} className="text-foreground" reduced={reducedMotion} />
            {interim && (
              <>
                {" "}
                <WordStream text={interim} className="text-secondary" reduced={reducedMotion} />
              </>
            )}
          </p>
        ) : (
          <p className="text-[13px] text-secondary">
            {mode === "thinking" ? "Einen Moment…" : "Sag einfach, was du bauen willst."}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-full border border-border-strong bg-surface-raised py-1.5 pl-1.5 pr-2">
        <button
          type="button"
          onClick={close}
          aria-label="Sprachmodus schliessen"
          className="focus-glow flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <X className="h-4 w-4" strokeWidth={1.8} />
        </button>

        {/* Finn's pose is the state indicator, no text label beside it. */}
        <AnimatedMascot state={MASCOT_FOR_MODE[mode]} size={34} alt="" className="shrink-0" />

        <VoiceWaveform
          mode={mode}
          readHalf={mic.readHalf}
          energyRef={energyRef}
          reducedMotion={reducedMotion}
          heightPx={32}
          className="min-w-0 flex-1"
        />

        <button
          type="button"
          onClick={primaryAction}
          disabled={primaryDisabled}
          aria-label={primaryLabel}
          title={primaryLabel}
          className="focus-glow flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {mode === "thinking" ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
          ) : mode === "speaking" ? (
            <SkipForward className="h-4 w-4" strokeWidth={1.8} />
          ) : (
            <Check className="h-4 w-4" strokeWidth={2.2} />
          )}
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Renders text word by word, fading each new word in as it arrives.
 *
 * Keyed by position + word so only genuinely new words animate: the recogniser
 * revises the tail of the current phrase constantly, and keying by index alone
 * would re-run the animation on every already-settled word each time it does.
 */
function WordStream({
  text,
  className,
  reduced,
}: {
  text: string;
  className?: string;
  reduced: boolean;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={`${i}-${word}`}
          initial={reduced ? false : { opacity: 0, y: 4, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          // Word gap as a right margin rather than a character between the
          // spans: an inline-block collapses a trailing normal space, and a
          // non-breaking one stops the transcript wrapping at all, which
          // overflows the moment a sentence gets long on a phone.
          className="mr-[0.26em] inline-block"
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}
