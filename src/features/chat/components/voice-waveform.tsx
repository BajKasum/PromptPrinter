"use client";

import { useEffect, useRef } from "react";
import {
  MIN_BAR,
  barCountForWidth,
  mirrorBars,
  stepBars,
  synthBars,
  type SpringState,
} from "@/features/chat/lib/voice-engine";

export type VoiceMode = "listening" | "thinking" | "speaking" | "paused";

/** Bar geometry, fixed in CSS pixels so density stays constant at any width. */
const BAR_WIDTH = 4;
const BAR_PITCH = 9; // 4px bar + 5px gap, the spacing ChatGPT's voice row uses
const MAX_BAR_HEIGHT = 56;

// Per-state spring feel and how hard the row is driven. Listening is the stiff,
// immediate one — it's following a voice and any softness reads as lag. The two
// synthetic states are slower on purpose: nothing is being tracked, so snappy
// motion there would look like noise rather than breathing.
const FEEL: Record<VoiceMode, { attack: number; release: number; gain: number }> = {
  listening: { attack: 1100, release: 240, gain: 1 },
  thinking: { attack: 260, release: 200, gain: 0.3 },
  speaking: { attack: 620, release: 300, gain: 0.92 },
  paused: { attack: 200, release: 160, gain: 0 },
};

/** `roundRect` is recent enough to be worth a fallback rather than a broken row. */
function barPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const r = Math.min(w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Reads an HSL token off the element so the canvas follows the theme. */
function token(el: Element, name: string, fallback: string): string {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  return raw || fallback;
}

/**
 * The waveform: a centred row of rounded bars, redrawn every animation frame.
 *
 * Canvas rather than DOM nodes, for three reasons that all showed up in
 * practice. Animating ~45 elements' heights re-runs layout every frame; using
 * `transform: scaleY` avoids that but squashes the rounded caps into ellipses,
 * which is exactly the detail that makes this look cheap. And driving any of it
 * through React state means ~45 re-renders per frame. A canvas has none of
 * those problems: one element, no layout, perfect caps, and the render loop
 * never touches React at all — `mode` is mirrored into a ref so a state change
 * doesn't restart the loop.
 *
 * Colours come from the design tokens at runtime (`--accent-text`, `--accent`)
 * and are re-read when the theme class flips, so this is the same blue as the
 * rest of the app in both themes. `--accent-text` carries the bars because
 * `--accent` is the light fill tone: on the light theme it measures under 2:1
 * against the background and the row would be nearly invisible. `--accent` does
 * the glow behind them, where being pale is the point.
 */
export function VoiceWaveform({
  mode,
  readHalf,
  energyRef,
  reducedMotion = false,
  heightPx = MAX_BAR_HEIGHT,
  className,
}: {
  mode: VoiceMode;
  /** Fills the array with live mic levels; false when no mic is running. */
  readHalf: (out: Float32Array) => boolean;
  /** 0..1 drive for the synthetic states, pushed by speech-synthesis events. */
  energyRef: React.RefObject<number>;
  reducedMotion?: boolean;
  /** Peak bar height in CSS px. Defaults to the full-height row; the inline
   *  composer bar passes a shorter one so it sits comfortably next to the
   *  send/cancel controls instead of dwarfing them. */
  heightPx?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Everything the loop reads lives in refs: the loop is started once and must
  // survive prop changes without being torn down mid-animation.
  const modeRef = useRef(mode);
  const reducedRef = useRef(reducedMotion);
  const readRef = useRef(readHalf);
  const heightRef = useRef(heightPx);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);
  useEffect(() => {
    readRef.current = readHalf;
  }, [readHalf]);
  useEffect(() => {
    heightRef.current = heightPx;
  }, [heightPx]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let springs: SpringState[] = [];
    let targets = new Float32Array(0);
    let half = new Float32Array(0);
    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = 1;

    function resize() {
      if (!wrap || !canvas || !ctx) return;
      const rect = wrap.getBoundingClientRect();
      if (rect.width === 0) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      cssWidth = rect.width;
      cssHeight = rect.height;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = barCountForWidth(cssWidth, BAR_PITCH);
      if (count !== springs.length) {
        // Carry the current heights across a resize so the row doesn't collapse
        // and spring back up when the window is dragged.
        const previous = springs;
        springs = Array.from({ length: count }, (_, i) => previous[i] ?? { value: MIN_BAR, velocity: 0 });
        targets = new Float32Array(count);
        half = new Float32Array(Math.ceil(count / 2));
      }
    }

    // Theme-aware colours, re-read when next-themes flips the class on <html>.
    let barColor = "204 76% 35%";
    let glowColor = "203 79% 72%";
    function readTokens() {
      if (!canvas) return;
      barColor = token(canvas, "--accent-text", barColor);
      glowColor = token(canvas, "--accent", glowColor);
    }
    readTokens();
    const themeObserver = new MutationObserver(readTokens);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(wrap);

    let raf = 0;
    let last = performance.now();

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (!ctx || springs.length === 0) return;

      const dt = (now - last) / 1000;
      last = now;

      const currentMode = modeRef.current;
      const feel = FEEL[currentMode];

      // Live audio only drives the listening state; the other two have no
      // signal to follow, so they run the deterministic shape instead. The
      // fallback also covers "listening, but the mic didn't open", which then
      // sits at the resting line rather than freezing on a stale frame.
      const live = currentMode === "listening" && readRef.current(half);
      if (live) {
        mirrorBars(half, targets);
      } else if (reducedRef.current) {
        // The undulation is decoration, not information: with reduced motion
        // the synthetic states hold a calm, flat line. Live mic levels are kept
        // in both cases — those are the actual content of this control.
        targets.fill(currentMode === "paused" ? 0 : MIN_BAR * 1.6);
      } else {
        synthBars(targets, now / 1000, energyRef.current ?? 0);
      }

      if (feel.gain !== 1) {
        for (let i = 0; i < targets.length; i++) targets[i] *= feel.gain;
      }

      stepBars(springs, targets, dt, feel.attack, feel.release);

      // ── draw ──────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      const centreY = cssHeight / 2;
      const totalWidth = springs.length * BAR_PITCH - (BAR_PITCH - BAR_WIDTH);
      const startX = (cssWidth - totalWidth) / 2;
      const mid = (springs.length - 1) / 2;

      // Two passes: a wide, faint halo in the pale accent, then the crisp bar.
      // Cheaper and more controllable than canvas shadowBlur, which costs a
      // full-surface blur per fill and is the usual reason these run at 30fps.
      for (let pass = 0; pass < 2; pass++) {
        const glow = pass === 0;
        for (let i = 0; i < springs.length; i++) {
          const level = Math.max(MIN_BAR, Math.min(1, springs[i].value));
          const h = level * heightRef.current;
          // Fade towards the ends so the row reads as one object with a centre
          // rather than a flat bar chart that happens to stop.
          const edge = 1 - Math.abs(i - mid) / mid;
          const alpha = (glow ? 0.16 : 0.55 + 0.45 * edge) * (currentMode === "paused" ? 0.4 : 1);
          const w = glow ? BAR_WIDTH * 2.1 : BAR_WIDTH;
          const x = startX + i * BAR_PITCH + (BAR_WIDTH - w) / 2;
          ctx.fillStyle = `hsl(${glow ? glowColor : barColor} / ${alpha})`;
          barPath(ctx, x, centreY - h / 2, w, h);
          ctx.fill();
        }
      }
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      themeObserver.disconnect();
    };
  }, [energyRef]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ height: heightPx + 12 }}
      // The row is decoration for sighted users; the state it represents is
      // announced in the voice bar's own sr-only live region, so it stays out
      // of the accessibility tree rather than being read as an unlabelled image.
      aria-hidden
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
