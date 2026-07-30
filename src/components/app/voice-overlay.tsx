"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Mic, MicOff, X, CornerDownLeft, SkipForward } from "lucide-react";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import type { MascotState } from "@/components/brand/mascot-states";
import { VoiceWaveform, type VoiceMode } from "@/components/app/voice-waveform";
import { useMicAnalyser } from "@/lib/use-mic-analyser";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { MAX_USER_MESSAGE_CHARS } from "@/lib/chat-limits";
import { cn } from "@/lib/utils";

/** Silence after a committed phrase before the turn is sent on its own. */
const AUTO_SEND_SILENCE_MS = 1500;

const MODE_COPY: Record<VoiceMode, { label: string; mascot: MascotState }> = {
  listening: { label: "Ich hör zu", mascot: "listening" },
  thinking: { label: "Ich denk nach", mascot: "thinking" },
  speaking: { label: "Finn spricht", mascot: "explaining" },
  paused: { label: "Pausiert", mascot: "waiting" },
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
 * Voice mode: a full-screen conversation with Finn, driven by the real
 * microphone.
 *
 * The four states are a loop — listening → thinking → speaking → listening —
 * and each one owns different hardware, which is what the effects below are
 * keeping straight:
 *
 *   listening  mic analyser drives the waveform, recogniser builds the
 *              transcript, a pause of AUTO_SEND_SILENCE_MS sends the turn
 *   thinking   recogniser off (it must not transcribe Finn), request in flight
 *   speaking   speech synthesis reads the reply; its word-boundary events push
 *              the waveform, since the API exposes no audio to analyse
 *   paused     everything muted, waveform resting
 *
 * The analyser itself stays open for the whole session rather than per state:
 * re-acquiring a mic stream takes a beat and re-flashes the recording
 * indicator, which looks like a bug when it happens after every sentence.
 */
export function VoiceOverlay({
  open,
  onClose,
  onSubmit,
  lang = "de-DE",
}: {
  open: boolean;
  onClose: () => void;
  /** Sends the spoken turn and resolves with Finn's reply (null if it failed). */
  onSubmit: (text: string) => Promise<string | null>;
  lang?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<VoiceMode>("listening");
  const [muted, setMuted] = useState(false);
  const [reply, setReply] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const reducedMotion = useReducedMotion() ?? false;

  useEffect(() => setMounted(true), []);

  const listening = open && mode === "listening" && !muted;
  const mic = useMicAnalyser(open && !muted);
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
    if (!open) return;
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
  }, [open]);

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
    if (mode !== "listening" || muted) return;
    if (!final.trim() || interim.trim()) return;
    const t = window.setTimeout(() => submitRef.current(final), AUTO_SEND_SILENCE_MS);
    return () => window.clearTimeout(t);
  }, [final, interim, mode, muted]);

  // ── lifecycle ───────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  const close = useCallback(() => {
    stopSpeaking();
    onClose();
  }, [onClose, stopSpeaking]);

  // Reset to a clean session on every open, and make sure nothing is still
  // being spoken when the overlay goes away (speechSynthesis is global and
  // outlives the component — without this, closing mid-sentence leaves Finn
  // talking to an empty screen).
  useEffect(() => {
    if (open) {
      setMode("listening");
      setMuted(false);
      setReply("");
      setSendError(null);
      reset();
      return;
    }
    stopSpeaking();
  }, [open, reset, stopSpeaking]);
  useEffect(() => stopSpeaking, [stopSpeaking]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [spokenText, reply]);

  if (!mounted) return null;

  const copy = MODE_COPY[muted ? "paused" : mode];
  const waveMode: VoiceMode = muted ? "paused" : mode;
  const blocker = !supported
    ? "Dieser Browser kann noch nicht mithören. In Chrome, Edge oder Safari funktioniert es."
    : mic.error ?? sttError ?? sendError;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Sprachmodus"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[120] flex flex-col bg-background/95 backdrop-blur-2xl"
        >
          {/* One ambient light from above, the same "Sonnenlicht statt
              Aquarium" gradient the marketing surfaces use. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[45vh] bg-[radial-gradient(ellipse_at_top,hsl(var(--accent)/0.16),transparent_70%)]"
          />

          <div className="relative flex items-center justify-between px-5 pt-5">
            <span className="text-[13px] font-medium text-secondary">Sprachmodus</span>
            <button
              type="button"
              onClick={close}
              aria-label="Sprachmodus schliessen"
              className="focus-glow flex h-9 w-9 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <X className="h-5 w-5" strokeWidth={1.8} />
            </button>
          </div>

          <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-2">
            <AnimatedMascot
              state={copy.mascot}
              size={132}
              alt=""
              className="shrink-0"
            />

            {/* State line. This is the accessible announcement of the state
                machine — the waveform itself is aria-hidden. */}
            {/* A crossfade, not AnimatePresence's `mode="wait"`. `wait` holds
                the new label back until the old one has finished exiting, so
                the label always trails the actual state by the exit duration —
                and during a fast listening → thinking → speaking run they queue
                up behind each other. Overlapping them in a fixed-height box
                means the state on screen is always the current one. */}
            <div aria-live="polite" className="relative h-6">
              <AnimatePresence initial={false}>
                <motion.span
                  key={copy.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-x-0 text-center text-[15px] font-medium text-accent-text"
                >
                  {copy.label}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Live transcript. Final words are solid, the phrase still being
                recognised stays muted until the engine commits it, so you can
                see it firming up rather than watching text rewrite itself. */}
            <div
              ref={transcriptRef}
              className="max-h-[34vh] w-full max-w-2xl overflow-y-auto text-center"
            >
              {blocker ? (
                <p className="text-balance text-[15px] leading-relaxed text-warning">{blocker}</p>
              ) : mode === "speaking" && reply ? (
                <p className="text-balance text-[17px] leading-[1.6] text-foreground/90">{reply}</p>
              ) : spokenText ? (
                <p className="text-balance text-[22px] leading-[1.45] tracking-[-0.01em] md:text-[26px]">
                  <WordStream text={final} className="text-foreground" reduced={reducedMotion} />
                  {interim && (
                    <>
                      {" "}
                      <WordStream text={interim} className="text-secondary" reduced={reducedMotion} />
                    </>
                  )}
                </p>
              ) : (
                <p className="text-[17px] text-secondary">
                  {mode === "thinking" ? "Einen Moment…" : "Sag einfach, was du bauen willst."}
                </p>
              )}
            </div>
          </div>

          {/* The waveform sits at the bottom, as asked, above the controls. */}
          <div className="relative px-6 pb-7">
            <VoiceWaveform
              mode={waveMode}
              readHalf={mic.readHalf}
              energyRef={energyRef}
              reducedMotion={reducedMotion}
              className="mx-auto w-full max-w-xl"
            />

            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-pressed={muted}
                aria-label={muted ? "Mikrofon einschalten" : "Mikrofon stummschalten"}
                className={cn(
                  "focus-glow flex h-12 w-12 items-center justify-center rounded-full border transition-colors",
                  muted
                    ? "border-border-strong bg-surface text-secondary hover:bg-surface-hover"
                    : "border-accent/40 bg-accent-subtle text-accent-text hover:bg-accent/20"
                )}
              >
                {muted ? (
                  <MicOff className="h-5 w-5" strokeWidth={1.8} />
                ) : (
                  <Mic className="h-5 w-5" strokeWidth={1.8} />
                )}
              </button>

              {mode === "speaking" ? (
                <button
                  type="button"
                  onClick={() => {
                    stopSpeaking();
                    setMode("listening");
                  }}
                  className="focus-glow inline-flex h-12 items-center gap-2 rounded-full border border-border-strong bg-surface px-5 text-[14px] font-medium text-foreground transition-colors hover:bg-surface-hover"
                >
                  <SkipForward className="h-4 w-4" strokeWidth={1.8} />
                  Überspringen
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => submit(spokenText)}
                  disabled={!spokenText.trim() || mode === "thinking"}
                  className="focus-glow inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                >
                  <CornerDownLeft className="h-4 w-4" strokeWidth={1.8} />
                  Absenden
                </button>
              )}
            </div>

            <p className="mt-3 text-center text-[12px] text-tertiary">
              {mode === "listening" && !muted
                ? "Ich schick es automatisch ab, wenn du fertig bist."
                : "Esc schliesst den Sprachmodus."}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
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
          initial={reduced ? false : { opacity: 0, y: 6, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
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
