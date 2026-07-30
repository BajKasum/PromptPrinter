// The maths behind the voice waveform, kept out of the React components so it
// can be reasoned about and tested without a browser, an AudioContext or a
// microphone. Everything here is pure: same inputs, same outputs, no time
// source of its own (callers pass `dt`).
//
// Three jobs:
//   1. decide which FFT bins each bar listens to      (`speechBands`)
//   2. turn a frame of FFT data into per-bar targets  (`readBands`, `mirrorBars`)
//   3. move the drawn bars towards those targets      (`springStep`)

/** Bars never render below this, so a silent mic still shows a thin resting line. */
export const MIN_BAR = 0.06;

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Frequency ranges for half the bars, log-spaced across the speech band.
 *
 * Two decisions worth keeping:
 *
 * Only 80–4200 Hz. An AnalyserNode's bins run to sampleRate/2 — 24 kHz at the
 * usual 48 kHz rate — and human speech puts almost nothing above ~4 kHz. Split
 * the bins linearly across the bars and roughly seven of every eight bars sit
 * in a range voices don't reach, so they never move: the waveform ends up
 * animating in one corner with a dead flat tail, which is exactly the tell of a
 * spectrum plotted without thinking about it.
 *
 * Log spacing rather than linear, because pitch is perceived logarithmically.
 * Linear bands give the low end one fat bar and smear every vowel formant
 * across the rest; log spacing spreads a voice evenly over the whole row, which
 * is what makes the movement read as "someone talking".
 *
 * Returns half the bars — `mirrorBars` reflects them into a symmetric row.
 */
export function speechBands(
  halfCount: number,
  sampleRate: number,
  fftSize: number,
  minHz = 80,
  maxHz = 4200
): Array<[number, number]> {
  const binCount = fftSize / 2;
  const hzPerBin = sampleRate / fftSize;
  const bands: Array<[number, number]> = [];
  const logMin = Math.log(minHz);
  const logMax = Math.log(maxHz);

  for (let i = 0; i < halfCount; i++) {
    const lo = Math.exp(logMin + ((logMax - logMin) * i) / halfCount);
    const hi = Math.exp(logMin + ((logMax - logMin) * (i + 1)) / halfCount);
    let start = Math.floor(lo / hzPerBin);
    let end = Math.ceil(hi / hzPerBin);
    // At the bottom of the range the log steps are narrower than one bin, so
    // neighbouring bars would claim the same single bin and move in lockstep.
    // Widening to at least one bin each and stepping the start forward keeps
    // every bar reading something of its own.
    if (end <= start) end = start + 1;
    if (i > 0 && start < bands[i - 1][0] + 1) start = bands[i - 1][0] + 1;
    if (end <= start) end = start + 1;
    bands.push([Math.min(start, binCount - 1), Math.min(end, binCount)]);
  }
  return bands;
}

/**
 * One frame of `getByteFrequencyData` → a 0..1 level per band.
 *
 * `gate` is a noise floor: room tone, fan noise and the mic's own hiss all sit
 * a little above zero, and without subtracting them the bars never settle, they
 * just shimmer at a low level forever. Everything below the gate collapses to
 * 0 and the remaining range is stretched back over 0..1, so silence is actually
 * still and the quietest real speech still registers.
 *
 * `curve` below 1 lifts quiet speech into visibility without flattening the
 * difference between quiet and loud — the brief is explicitly that quiet
 * speech stays short and loud speech grows tall, so this deliberately stops
 * well short of the full normalisation a level meter would do.
 */
export function readBands(
  freq: Uint8Array,
  bands: Array<[number, number]>,
  out: Float32Array,
  gate = 0.12,
  curve = 0.8
): Float32Array {
  for (let i = 0; i < bands.length; i++) {
    const [start, end] = bands[i];
    let sum = 0;
    for (let b = start; b < end; b++) sum += freq[b];
    const mean = sum / (end - start) / 255;
    const gated = mean <= gate ? 0 : (mean - gate) / (1 - gate);
    out[i] = clamp01(Math.pow(gated, curve));
  }
  return out;
}

/**
 * Reflects half a row of bars into a full symmetric one, lowest frequency in
 * the middle. Voices carry most of their energy low, so the row blooms from the
 * centre outwards — the shape ChatGPT's voice mode has, and the reason it reads
 * as one object breathing rather than a graph being plotted left to right.
 */
export function mirrorBars(half: Float32Array, out: Float32Array): Float32Array {
  const n = out.length;
  const mid = n / 2;
  for (let i = 0; i < n; i++) {
    // Distance from the centre line, so index 0 of `half` lands in the middle.
    const d = i < mid ? Math.floor(mid - 1 - i) : Math.floor(i - mid);
    out[i] = half[Math.min(d, half.length - 1)];
  }
  return out;
}

export type SpringState = { value: number; velocity: number };

/**
 * One critically-damped spring step (semi-implicit Euler).
 *
 * Asymmetric on purpose: `attack` is much stiffer than `release`, so a bar
 * snaps up the moment you speak and glides back down. Symmetric smoothing
 * either lags the attack (feels laggy and disconnected from your voice) or
 * makes the decay twitchy (reads as jitter). Fast up / slow down is what
 * hardware level meters have always done and it's most of why this feels
 * physical rather than interpolated.
 *
 * `dt` is clamped and sub-stepped by the caller (`stepBars`); an explicit
 * Euler spring goes unstable once stiffness·dt² gets large, which in practice
 * means one dropped frame turning into bars that shoot off screen.
 */
export function springStep(
  state: SpringState,
  target: number,
  dt: number,
  attack = 900,
  release = 260
): SpringState {
  const stiffness = target > state.value ? attack : release;
  // Critical damping: no overshoot, no ringing, the fastest approach that
  // never wobbles around the target.
  const damping = 2 * Math.sqrt(stiffness);
  const accel = stiffness * (target - state.value) - damping * state.velocity;
  const velocity = state.velocity + accel * dt;
  return { value: state.value + velocity * dt, velocity };
}

/** Largest timestep a spring step may take before it's split (≈120 Hz). */
export const MAX_STEP = 1 / 120;

/**
 * Advances every bar towards its target, sub-stepping so a long frame (a
 * background tab waking up, a slow paint) can't destabilise the springs or make
 * the row visibly lurch. This is what keeps the motion identical at 60, 120 and
 * 144 Hz instead of the springs running faster on faster displays.
 */
export function stepBars(
  states: SpringState[],
  targets: Float32Array,
  dt: number,
  attack?: number,
  release?: number
): void {
  // A tab that was hidden for ten seconds reports a ten-second frame; treat
  // anything beyond a couple of frames as a pause rather than replaying it.
  const total = Math.min(dt, 0.1);
  const steps = Math.max(1, Math.ceil(total / MAX_STEP));
  const step = total / steps;
  for (let i = 0; i < states.length; i++) {
    let s = states[i];
    const target = Math.max(MIN_BAR, targets[i]);
    for (let n = 0; n < steps; n++) s = springStep(s, target, step, attack, release);
    states[i] = s;
  }
}

/**
 * The shape the bars take while Finn is talking or thinking, when there is no
 * microphone signal to follow.
 *
 * Deliberately NOT random: it's a fixed pair of travelling sines driven by the
 * clock and by `energy`, so the row undulates like a voice instead of flickering
 * like static, and the same moment always looks the same. While speaking,
 * `energy` is pushed by real word-boundary events from the speech synthesiser
 * (see voice-overlay.tsx), so the movement tracks actual speech — it just isn't
 * a spectrum of it, because the Web Speech API gives no access to its own
 * output audio.
 */
export function synthBars(
  out: Float32Array,
  timeSeconds: number,
  energy: number,
  centreBias = 0.55
): Float32Array {
  const n = out.length;
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    // 1 in the middle, 0 at the ends — keeps the row centre-weighted like the
    // mirrored spectrum, so switching between states doesn't change its shape.
    const fromCentre = 1 - Math.abs(i - mid) / mid;
    const envelope = centreBias + (1 - centreBias) * fromCentre;
    const wave =
      0.5 + 0.32 * Math.sin(timeSeconds * 3.1 + i * 0.42) + 0.18 * Math.sin(timeSeconds * 1.7 - i * 0.23);
    out[i] = clamp01(energy * envelope * wave);
  }
  return out;
}

/**
 * How many bars fit a given width at a fixed pitch, so bar width and gap stay
 * constant and only the count changes with the modal's size. Clamped to an odd
 * count: a mirrored row wants a true centre bar, an even count puts the seam
 * between two bars and the bloom looks off by half a step.
 */
export function barCountForWidth(width: number, pitch = 9, min = 21, max = 65): number {
  const raw = Math.floor(width / pitch);
  const clamped = Math.max(min, Math.min(max, raw));
  return clamped % 2 === 0 ? clamped - 1 : clamped;
}
