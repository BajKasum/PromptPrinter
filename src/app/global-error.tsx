"use client";

// Last-resort boundary: only renders when the ROOT layout itself throws, which
// means globals.css and the font setup may never have loaded. So this page is
// deliberately self-contained with inline styles — no Tailwind, no imports — so
// it stays on-brand and readable even in a catastrophic failure.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0C0E12",
          color: "#E8EBEF",
          padding: "1.5rem",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <div
            style={{
              marginBottom: "0.75rem",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#fca5a5",
            }}
          >
            Kritischer Fehler
          </div>
          <h1
            style={{
              margin: "0 0 0.75rem",
              fontSize: "26px",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              fontWeight: 600,
            }}
          >
            Die App konnte nicht geladen werden
          </h1>
          <p
            style={{
              margin: "0 0 1.5rem",
              fontSize: "14px",
              lineHeight: 1.5,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            Ein unerwarteter Fehler hat die Anwendung gestoppt. Versuch es erneut
            — wenn das Problem bleibt, lade die Seite später neu.
          </p>
          {error.digest && (
            <p
              style={{
                margin: "0 0 1.5rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "11px",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              Fehler-ID: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: "44px",
              padding: "0 1.25rem",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor: "#15679E",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
