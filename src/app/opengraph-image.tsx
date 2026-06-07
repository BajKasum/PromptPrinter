import { ImageResponse } from "next/og";

// Render on the Edge runtime. The Node build of @vercel/og locates its bundled
// font/wasm via path.join(import.meta.url, …); on Windows path.join mangles the
// file:// URL into an invalid one, so `next build` throws "Invalid URL" while
// prerendering this route. The Edge runtime loads those assets a different way
// and builds cleanly on every platform (this is also Next's documented runtime
// for metadata image routes).
export const runtime = "edge";

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
          background: "#0C0E12",
          backgroundImage:
            "radial-gradient(900px 480px at 75% 0%, rgba(143,205,242,0.18), transparent)",
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
              color: "#8FCDF2",
              border: "1px solid rgba(143,205,242,0.4)",
              background: "rgba(143,205,242,0.12)",
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
          <span style={{ color: "#E8EBEF" }}>Aus rohen Ideen&nbsp;</span>
          <span style={{ color: "#8FCDF2" }}>build-fertige Prompts.</span>
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
