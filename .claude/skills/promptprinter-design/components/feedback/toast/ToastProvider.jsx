import React, { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const AUTO_DISMISS_MS = 4000;

function ToastStyle() {
  return (
    <style>{`
@keyframes pp-toast-in{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
.pp-toast-viewport{position:fixed;bottom:16px;right:16px;z-index:100;display:flex;flex-direction:column;gap:8px;width:calc(100% - 32px);max-width:384px;pointer-events:none;}
.pp-toast{pointer-events:auto;display:flex;align-items:flex-start;gap:12px;border-radius:var(--radius-xl);border:1px solid hsl(var(--border));background:hsl(var(--surface-raised) / 0.95);backdrop-filter:blur(16px);box-shadow:var(--shadow-elevated);padding:12px 16px;animation:pp-toast-in .22s var(--ease-out-expo);font-family:var(--font-sans);}
.pp-toast-title{font-size:13.5px;font-weight:500;color:hsl(var(--foreground));margin:0;}
.pp-toast-desc{font-size:12.5px;color:hsl(var(--muted-foreground));margin:2px 0 0;}
.pp-toast-close{flex-shrink:0;background:none;border:none;cursor:pointer;color:hsl(var(--muted-foreground));padding:0;}
.pp-toast-close:hover{color:hsl(var(--foreground));}
`}</style>
  );
}

/** Mascot artwork for success/error toasts; falls back to a plain dot for "default". `mascotBase` should point at assets/mascot relative to the consuming page. */
function ToastGlyph({ variant, mascotBase }) {
  if (variant === "default") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: "hsl(var(--accent-text))", marginTop: 2, flexShrink: 0 }} aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 16v-5" /><path d="M12 8h.01" />
      </svg>
    );
  }
  const src = `${mascotBase}/dolphin-${variant === "success" ? "celebrating" : "sad"}.png`;
  return <img src={src} alt="" width={28} height={28} style={{ marginTop: -4, flexShrink: 0 }} />;
}

export function ToastProvider({ children, mascotBase = "../../../assets/mascot" }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "default" }) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      window.setTimeout(() => remove(id), AUTO_DISMISS_MS);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastStyle />
      {children}
      <div aria-live="polite" className="pp-toast-viewport">
        {toasts.map((t) => (
          <div key={t.id} role="status" className="pp-toast">
            <ToastGlyph variant={t.variant} mascotBase={mascotBase} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="pp-toast-title">{t.title}</p>
              {t.description && <p className="pp-toast-desc">{t.description}</p>}
            </div>
            <button type="button" onClick={() => remove(t.id)} aria-label="Benachrichtigung schliessen" className="pp-toast-close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
