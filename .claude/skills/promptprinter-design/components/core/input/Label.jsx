import React from "react";

/** Form field label — mono, uppercase, wide tracking (matches label-caps type token). */
export function Label({ className = "", style, children, ...props }) {
  return (
    <>
      <style>{`.pp-label{font-size:11px;font-family:var(--font-mono);font-weight:500;text-transform:uppercase;letter-spacing:.08em;color:hsl(var(--muted-foreground));display:block;margin-bottom:6px;}`}</style>
      <label className={`pp-label ${className}`.trim()} style={style} {...props}>
        {children}
      </label>
    </>
  );
}
