"use client";

import "client-only";

import { useCallback, useEffect, useRef, useState } from "react";
import { readBands, speechBands } from "@/features/chat/lib/voice-engine";

export type MicStatus = "idle" | "starting" | "running" | "denied" | "unsupported" | "failed";

/** What the caller gets back; `readHalf` is safe to call every frame. */
export type MicAnalyser = {
  status: MicStatus;
  /** Human-readable reason when status is denied/unsupported/failed. */
  error: string | null;
  /**
   * Fills `out` with one 0..1 level per half-bar for the current audio frame.
   * Returns false when nothing is running, so the caller can fall back to a
   * synthetic shape without branching on `status` inside its render loop.
   */
  readHalf: (out: Float32Array) => boolean;
};

/**
 * Microphone → AnalyserNode, opened while `active` is true and fully torn down
 * the moment it isn't.
 *
 * Teardown is the part that matters and the part that's usually wrong: the
 * MediaStreamTrack has to be stopped explicitly or the browser's recording
 * indicator stays lit after the modal closes, which reads to the user as an app
 * that's still listening. Closing the AudioContext as well keeps a page that
 * opens and closes the modal repeatedly from stacking up contexts (browsers cap
 * them per document, and hitting the cap makes audio silently stop working
 * until reload).
 */
export function useMicAnalyser(active: boolean): MicAnalyser {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const analyserRef = useRef<AnalyserNode | null>(null);
  const freqRef = useRef<Uint8Array | null>(null);
  const bandsRef = useRef<Array<[number, number]> | null>(null);
  // Bands depend on the bar count, which depends on the modal's width, so they
  // are rebuilt lazily whenever the requested length changes rather than being
  // computed once at open time.
  const bandsLengthRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;

    async function start() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        setError("Dieser Browser gibt keinen Zugriff auf das Mikrofon.");
        return;
      }
      setStatus("starting");
      setError(null);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            // Off on purpose. Automatic gain control exists to make everything
            // arrive at the same loudness, which is the exact opposite of what
            // this waveform is for: with AGC on, a whisper and a shout both
            // produce full-height bars after a second or so of adaptation, and
            // the "quiet is short, loud is tall" behaviour disappears.
            autoGainControl: false,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        context = new AudioContext();
        // Browsers hand back a suspended context when it wasn't created inside
        // a user gesture; opening the modal is a click, but the await above
        // means we're no longer synchronously inside it on every path.
        if (context.state === "suspended") await context.resume();

        const analyser = context.createAnalyser();
        // 1024 gives 512 bins ≈ 47 Hz each at 48 kHz: fine enough to separate
        // the low formants that carry a voice, coarse enough that one frame is
        // cheap to reduce every 16 ms.
        analyser.fftSize = 1024;
        // The analyser's own EMA. Kept low because the springs downstream do
        // the real smoothing — stacking a high value here on top of them is
        // what makes these waveforms feel laggy and underwater.
        analyser.smoothingTimeConstant = 0.55;
        // Default is -100..-30 dB, which maps most of a normal speaking voice
        // into the top sliver of the 0..255 range. Narrowing it spreads real
        // speech across the range instead.
        analyser.minDecibels = -85;
        analyser.maxDecibels = -25;

        context.createMediaStreamSource(stream).connect(analyser);
        // Deliberately not connected to context.destination: routing the mic to
        // the speakers is a feedback loop, and nothing here needs to be heard.

        analyserRef.current = analyser;
        freqRef.current = new Uint8Array(analyser.frequencyBinCount);
        bandsRef.current = null;
        bandsLengthRef.current = 0;
        setStatus("running");
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof DOMException ? e.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied");
          setError(
            "Ich brauche Zugriff auf dein Mikrofon. Erlaub ihn in der Adresszeile und versuch es nochmal."
          );
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setStatus("failed");
          setError("Ich finde kein Mikrofon an diesem Gerät.");
        } else {
          setStatus("failed");
          setError("Das Mikrofon liess sich nicht öffnen.");
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      analyserRef.current = null;
      freqRef.current = null;
      bandsRef.current = null;
      // Order matters: drop the track first so the recording indicator goes out
      // immediately, then close the context.
      stream?.getTracks().forEach((t) => t.stop());
      void context?.close().catch(() => {});
      setStatus("idle");
      setError(null);
    };
  }, [active]);

  const readHalf = useCallback((out: Float32Array) => {
    const analyser = analyserRef.current;
    const freq = freqRef.current;
    if (!analyser || !freq) return false;

    if (!bandsRef.current || bandsLengthRef.current !== out.length) {
      bandsRef.current = speechBands(
        out.length,
        analyser.context.sampleRate,
        analyser.fftSize
      );
      bandsLengthRef.current = out.length;
    }
    // The typed-array generic changed shape across TS DOM lib versions; the
    // analyser only ever writes into the buffer it was sized for.
    analyser.getByteFrequencyData(freq as Uint8Array<ArrayBuffer>);
    readBands(freq, bandsRef.current, out);
    return true;
  }, []);

  return { status, error, readHalf };
}
