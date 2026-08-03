"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MotionPathPlugin);

type Point = { x: number; y: number };

// One continuous winding spine through every node's real center, not three
// independent straight segments. Endpoints stay pinned exactly on each icon;
// only the curve between them bows left/right (alternating per segment), so
// it reads as one drawn path threading the whole journey, the way
// NoteMage's does, rather than a stack of separate connector bars.
function buildSpinePath(points: Point[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const dy = (p1.y - p0.y) / 3;
    const bow = i % 2 === 1 ? 11 : -11;
    d += ` C ${p0.x + bow} ${p0.y + dy}, ${p1.x + bow} ${p1.y - dy}, ${p1.x} ${p1.y}`;
  }
  return d;
}

/**
 * The GSAP-powered piece of How-It-Works' step rail, isolated into its own
 * chunk (see how-it-works.tsx's dynamic(..., { ssr: false }) import) so
 * GSAP + DrawSVG/MotionPath, a real payload, never lands in the landing
 * page's initial JS. Purely decorative: `nodeRefs`/`railRef` belong to
 * already-rendered, already-meaningful content in the parent, so this
 * component loading a beat later (or never, if JS fails) never costs the
 * page any real information.
 */
export function HowItWorksSpine({
  railRef,
  nodeRefs,
  reduceMotion,
}: {
  railRef: RefObject<HTMLDivElement | null>;
  nodeRefs: RefObject<(HTMLDivElement | null)[]>;
  reduceMotion: boolean;
}) {
  const trackPathRef = useRef<SVGPathElement>(null);
  const drawPathRef = useRef<SVGPathElement>(null);
  const markerRef = useRef<SVGGElement>(null);

  const [rail, setRail] = useState<{ w: number; h: number; d: string } | null>(null);

  // Measure real node centers (not guessed coordinates) so the spine always
  // threads exactly through each icon, at any viewport width or content
  // height, text length, breakpoint, font load, all self-correct via the
  // observer instead of a hardcoded path.
  useEffect(() => {
    const railEl = railRef.current;
    if (!railEl) return;

    function measure() {
      const railElement = railRef.current;
      if (!railElement) return;
      const railRect = railElement.getBoundingClientRect();
      const points = nodeRefs.current
        .filter((el): el is HTMLDivElement => Boolean(el))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2 - railRect.left, y: r.top + r.height / 2 - railRect.top };
        });
      if (points.length < 2) return;
      setRail({ w: railRect.width, h: railRect.height, d: buildSpinePath(points) });
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(railEl);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [railRef, nodeRefs]);

  // Draw the spine and send the marker traveling along it, both scrubbed to
  // scroll position, GSAP's DrawSVG (the line) and MotionPath (the marker)
  // driven by the same ScrollTrigger timeline so they stay perfectly in sync.
  useEffect(() => {
    if (!rail?.d) return;
    const path = drawPathRef.current;
    const marker = markerRef.current;
    if (!path || !marker) return;

    if (reduceMotion) {
      gsap.set(path, { drawSVG: "100%" });
      gsap.set(marker, { autoAlpha: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(path, { drawSVG: "0%" });
      gsap.set(marker, { autoAlpha: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: railRef.current,
          start: "top 80%",
          end: "bottom 60%",
          scrub: 0.6,
        },
      });
      tl.to(marker, { autoAlpha: 1, duration: 0.001 }, 0)
        .to(path, { drawSVG: "100%", ease: "none" }, 0)
        .to(
          marker,
          {
            motionPath: { path, align: path, alignOrigin: [0.5, 0.5], autoRotate: false },
            ease: "none",
          },
          0
        );
    }, railRef);

    return () => ctx.revert();
  }, [rail?.d, reduceMotion, railRef]);

  if (!rail) return null;

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute left-0 top-0"
      width={rail.w}
      height={rail.h}
      viewBox={`0 0 ${rail.w} ${rail.h}`}
    >
      <path
        ref={trackPathRef}
        d={rail.d}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <path
        ref={drawPathRef}
        d={rail.d}
        fill="none"
        stroke="hsl(var(--accent))"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* The traveling marker, a small living spark, not a game-board
          token, so it stays inside Finn's ocean-of-light vocabulary. */}
      <g ref={markerRef} style={{ opacity: 0 }}>
        <circle r={9} fill="hsl(var(--accent))" opacity={0.3} />
        <circle r={3.5} fill="hsl(var(--accent-text))" />
      </g>
    </svg>
  );
}
