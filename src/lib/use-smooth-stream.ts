"use client";

import { useEffect, useRef, useState } from "react";

// The model hands text over in bursts: one SSE delta can be a single token or
// a whole paragraph, and the gaps between them are uneven. Painting each delta
// the moment it lands is what made a long reply arrive as a stack of blocks
// rather than as writing. This buffers the received text and reveals it at a
// steady, self-balancing rate instead: whatever is waiting gets written out
// over roughly DRAIN_MS, but never slower than MIN_CHARS_PER_SECOND. The text,
// its order and its total duration are unchanged, only the pacing is.
//
// Self-balancing matters more than any fixed speed here: a fast provider that
// dumps 800 characters at once is swept out in the same ~quarter second as a
// slow one trickling 30, so the reveal can never fall meaningfully behind what
// has actually arrived, and the reader never waits on an animation for text
// the browser already has.
const DRAIN_MS = 280;
const MIN_CHARS_PER_SECOND = 130;

// react-markdown re-parses the entire reply on every update, so the reveal is
// deliberately capped well below the display refresh rate. At 30 steps per
// second the writing still reads as continuous, at 60 a long prompt would
// spend most of its frame budget re-parsing markdown.
const FRAME_MS = 1000 / 30;

/**
 * Reveals `target` progressively as it grows, for streamed assistant replies.
 *
 * Returns the slice to render plus whether the reveal has caught up with
 * everything received so far. `settled` is what lets the caller wait for the
 * writing to actually finish before committing the message, so the tail of a
 * long prompt doesn't pop in whole at the very moment the user is watching for
 * it to be done.
 *
 * Mount this only while a reply is streaming (the animation loop lives for as
 * long as the hook does), and let it unmount once the reply is committed.
 */
export function useSmoothStream(target: string) {
  const [shown, setShown] = useState(0);

  // The loop reads the newest text through a ref so that an arriving chunk
  // never restarts it, restarting would reset its frame timing on every delta,
  // which is precisely the stutter this hook exists to remove.
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    let raf = 0;
    // Seeded from the first frame rather than performance.now(): the animation
    // clock is not guaranteed to share an origin with performance.now() (in
    // jsdom it trails it by seconds), and mixing the two yields a permanently
    // negative delta, i.e. a reveal that never advances at all.
    let last = -1;

    function step(now: number) {
      raf = requestAnimationFrame(step);
      if (last < 0) {
        last = now;
        return;
      }
      const dt = now - last;
      if (dt < FRAME_MS) return;
      last = now;
      setShown((current) => {
        const total = targetRef.current.length;
        // Nothing waiting: returning the identical value makes React bail out,
        // so an idle loop costs a callback per frame and no re-render.
        if (current >= total) return current;
        const perSecond = Math.max(
          MIN_CHARS_PER_SECOND,
          ((total - current) / DRAIN_MS) * 1000
        );
        return Math.min(total, current + Math.max(1, Math.round((perSecond * dt) / 1000)));
      });
    }

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // A shorter target than what's already revealed can only mean the caller
  // reused the hook for a fresh reply; clamp rather than slicing past the end.
  const revealed = Math.min(shown, target.length);
  return { text: target.slice(0, revealed), settled: revealed >= target.length };
}
