import { ImageResponse } from "next/og";

// Branded 1200×630 social card. Next auto-injects this into the OpenGraph and
// Twitter tags defined in the root layout, so shares finally show a preview.
export const alt = "PromptPrinter — Aus rohen Ideen build-fertige Prompts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A0A0A",
          backgroundImage:
            "radial-gradient(900px 480px at 75% 0%, rgba(124,58,237,0.22), transparent)",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#C4B5FD",
              border: "1px solid rgba(124,58,237,0.4)",
              background: "rgba(124,58,237,0.10)",
              borderRadius: 999,
              padding: "8px 18px",
            }}
          >
            v2.0 Beta
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          <span style={{ color: "white" }}>Aus rohen Ideen&nbsp;</span>
          <span style={{ color: "#A78BFA" }}>build-fertige Prompts.</span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "rgba(255,255,255,0.55)",
            fontSize: 28,
          }}
        >
          <div style={{ display: "flex", color: "white", fontWeight: 600 }}>PromptPrinter</div>
          <div style={{ display: "flex" }}>promptprinter.app</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
