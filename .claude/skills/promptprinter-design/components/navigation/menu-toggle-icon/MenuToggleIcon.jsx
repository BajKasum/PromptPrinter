import React from "react";

/** Animated hamburger ⇆ close icon. Purely presentational — the toggling button owns aria-label/aria-expanded. */
export function MenuToggleIcon({ open, className = "", duration = 300, style, ...props }) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{
        transition: `transform ${duration}ms ease-in-out`,
        transform: open ? "rotate(-45deg)" : "none",
        ...style,
      }}
      {...props}
    >
      <path
        style={{
          transition: `stroke-dasharray ${duration}ms ease-in-out, stroke-dashoffset ${duration}ms ease-in-out`,
          strokeDasharray: open ? "20 300" : "12 63",
          strokeDashoffset: open ? "-32.42px" : "0",
        }}
        d="M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22"
      />
      <path d="M7 16 27 16" />
    </svg>
  );
}
