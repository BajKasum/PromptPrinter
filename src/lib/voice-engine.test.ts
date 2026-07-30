import { describe, it, expect } from "vitest";
import {
  MIN_BAR,
  barCountForWidth,
  clamp01,
  mirrorBars,
  readBands,
  speechBands,
  springStep,
  stepBars,
  synthBars,
  type SpringState,
} from "@/lib/voice-engine";

const SAMPLE_RATE = 48000;
const FFT = 1024;

describe("speechBands", () => {
  it("stays inside the speech range instead of spreading over the full spectrum", () => {
    const bands = speechBands(16, SAMPLE_RATE, FFT);
    const hzPerBin = SAMPLE_RATE / FFT;
    const highestHz = bands[bands.length - 1][1] * hzPerBin;
    // The whole point: without the cap this would run to sampleRate/2 (24 kHz)
    // and most bars would sit in a range no voice reaches.
    expect(highestHz).toBeLessThan(5000);
    expect(bands[0][0] * hzPerBin).toBeLessThan(200);
  });

  it("gives every bar its own bins, including at the crowded low end", () => {
    const bands = speechBands(32, SAMPLE_RATE, FFT);
    expect(bands).toHaveLength(32);
    for (const [start, end] of bands) expect(end).toBeGreaterThan(start);
    // Log spacing packs the first bars into very few bins; without the nudge in
    // speechBands they would share one bin and move in lockstep.
    const starts = bands.map((b) => b[0]);
    expect(new Set(starts).size).toBe(starts.length);
  });

  it("never indexes past the available bins", () => {
    const bands = speechBands(48, 8000, 256); // deliberately awkward: 4 kHz Nyquist
    for (const [start, end] of bands) {
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThanOrEqual(256 / 2);
    }
  });
});

describe("readBands", () => {
  const bands: Array<[number, number]> = [
    [0, 2],
    [2, 4],
  ];

  it("reports silence as exactly zero rather than a shimmer", () => {
    const out = readBands(new Uint8Array([0, 0, 0, 0]), bands, new Float32Array(2));
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0);
  });

  it("gates out low room tone", () => {
    // 0.1 of full scale, below the 0.12 default gate.
    const quiet = Math.round(0.1 * 255);
    const out = readBands(new Uint8Array([quiet, quiet, quiet, quiet]), bands, new Float32Array(2));
    expect(out[0]).toBe(0);
  });

  it("keeps quiet speech short and loud speech tall", () => {
    const level = (v: number) => {
      const b = Math.round(v * 255);
      return readBands(new Uint8Array([b, b, b, b]), bands, new Float32Array(2))[0];
    };
    const quiet = level(0.3);
    const loud = level(0.9);
    expect(quiet).toBeGreaterThan(0);
    // The brief is explicit that the difference must stay legible, so this
    // guards against over-normalising quiet input up towards full height.
    expect(quiet).toBeLessThan(0.45);
    expect(loud).toBeGreaterThan(0.8);
    expect(loud - quiet).toBeGreaterThan(0.4);
  });

  it("clamps into 0..1", () => {
    const out = readBands(new Uint8Array([255, 255, 255, 255]), bands, new Float32Array(2));
    expect(out[0]).toBeLessThanOrEqual(1);
    expect(out[0]).toBeGreaterThanOrEqual(0);
  });
});

describe("mirrorBars", () => {
  it("puts the lowest band in the middle and reflects outwards", () => {
    const half = new Float32Array([1, 0.5, 0.25]);
    const out = mirrorBars(half, new Float32Array(6));
    expect(Array.from(out)).toEqual([0.25, 0.5, 1, 1, 0.5, 0.25]);
  });

  it("is symmetric for an odd bar count too", () => {
    const half = new Float32Array([1, 0.4]);
    const out = mirrorBars(half, new Float32Array(5));
    expect(out[0]).toBeCloseTo(out[4], 5);
    expect(out[1]).toBeCloseTo(out[3], 5);
  });
});

describe("springStep", () => {
  it("converges on the target without overshooting", () => {
    let s: SpringState = { value: 0, velocity: 0 };
    let maxValue = 0;
    for (let i = 0; i < 400; i++) {
      s = springStep(s, 1, 1 / 240);
      maxValue = Math.max(maxValue, s.value);
    }
    expect(s.value).toBeCloseTo(1, 2);
    // Critical damping: it must not ring past the target and bounce back.
    expect(maxValue).toBeLessThanOrEqual(1.001);
  });

  it("rises faster than it falls", () => {
    let up: SpringState = { value: 0, velocity: 0 };
    let down: SpringState = { value: 1, velocity: 0 };
    for (let i = 0; i < 6; i++) {
      up = springStep(up, 1, 1 / 240);
      down = springStep(down, 0, 1 / 240);
    }
    // Same number of steps, same distance: the attack must have covered more
    // ground. This asymmetry is what makes the row track a voice instead of
    // lagging behind it.
    expect(up.value).toBeGreaterThan(1 - down.value);
  });
});

describe("stepBars", () => {
  it("never drops a bar below the resting height", () => {
    const states: SpringState[] = [{ value: 0.9, velocity: 0 }];
    for (let i = 0; i < 200; i++) stepBars(states, new Float32Array([0]), 1 / 60);
    expect(states[0].value).toBeGreaterThanOrEqual(MIN_BAR - 0.001);
  });

  it("stays stable across a long stalled frame", () => {
    const states: SpringState[] = [{ value: 0, velocity: 0 }];
    // A backgrounded tab reports a huge dt; an unclamped explicit Euler spring
    // goes unstable here and the bars shoot off screen on the next paint.
    stepBars(states, new Float32Array([1]), 12);
    expect(Number.isFinite(states[0].value)).toBe(true);
    expect(states[0].value).toBeLessThanOrEqual(1.05);
    expect(states[0].value).toBeGreaterThanOrEqual(0);
  });

  it("lands in the same place at 60 and 144 Hz", () => {
    const run = (fps: number) => {
      const states: SpringState[] = [{ value: 0, velocity: 0 }];
      const dt = 1 / fps;
      for (let t = 0; t < 0.25; t += dt) stepBars(states, new Float32Array([1]), dt);
      return states[0].value;
    };
    // Sub-stepping is what makes this true; without it the springs run at
    // different speeds on different displays.
    expect(Math.abs(run(60) - run(144))).toBeLessThan(0.02);
  });
});

describe("synthBars", () => {
  it("is deterministic — the same moment always looks the same", () => {
    const a = synthBars(new Float32Array(9), 3.5, 0.8);
    const b = synthBars(new Float32Array(9), 3.5, 0.8);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("collapses to nothing at zero energy", () => {
    const out = synthBars(new Float32Array(9), 1.2, 0);
    expect(Array.from(out).every((v) => v === 0)).toBe(true);
  });

  it("weights the centre over the edges", () => {
    // Averaged over time so this tests the envelope, not one phase of the sines.
    let centre = 0;
    let edge = 0;
    for (let t = 0; t < 40; t++) {
      const out = synthBars(new Float32Array(11), t * 0.11, 1);
      centre += out[5];
      edge += out[0];
    }
    expect(centre).toBeGreaterThan(edge);
  });

  it("stays inside 0..1", () => {
    for (let t = 0; t < 60; t++) {
      const out = synthBars(new Float32Array(15), t * 0.07, 1);
      for (const v of out) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("barCountForWidth", () => {
  it("keeps density constant by scaling the count, not the bars", () => {
    expect(barCountForWidth(360)).toBeLessThan(barCountForWidth(560));
  });

  it("always returns an odd count so the mirrored row has a true centre", () => {
    for (const w of [200, 301, 402, 640, 900, 2000]) {
      expect(barCountForWidth(w) % 2).toBe(1);
    }
  });

  it("clamps at both ends", () => {
    expect(barCountForWidth(10)).toBeGreaterThanOrEqual(21);
    expect(barCountForWidth(99999)).toBeLessThanOrEqual(65);
  });
});

describe("clamp01", () => {
  it("clamps", () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(9)).toBe(1);
  });
});
