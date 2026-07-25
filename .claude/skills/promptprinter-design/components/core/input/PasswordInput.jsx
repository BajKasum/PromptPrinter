import React, { useState } from "react";

/** Password field with a built-in show/hide toggle. Drop-in for `<Input type="password">`. */
export const PasswordInput = React.forwardRef(function PasswordInput({ className = "", style, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <style>{`
.pp-input{height:44px;width:100%;border-radius:var(--radius-lg);border:1px solid hsl(var(--border));background:hsl(var(--surface));padding:0 44px 0 14px;font-size:14px;font-family:var(--font-sans);color:hsl(var(--foreground));transition:border-color .2s,box-shadow .2s;outline:none;box-sizing:border-box;}
.pp-input::placeholder{color:hsl(var(--muted-foreground));}
.pp-input:focus{border-color:hsl(var(--ring));box-shadow:0 0 0 3px hsl(var(--ring)/.18),0 0 10px hsl(var(--ring)/.16);}
.pp-pw-toggle{position:absolute;right:0;top:0;height:44px;width:44px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;cursor:pointer;color:hsl(var(--muted-foreground));}
.pp-pw-toggle:hover{color:hsl(var(--foreground));}
`}</style>
      <input ref={ref} type={visible ? "text" : "password"} className={`pp-input ${className}`.trim()} style={style} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
        aria-pressed={visible}
        className="pp-pw-toggle"
      >
        {visible ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 3l18 18" /><path d="M10.6 5.1A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-3.1 3.9M6.6 6.6C3.8 8.3 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.4-1" /><path d="M9.5 9.5a3 3 0 0 0 4.24 4.24" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
});
