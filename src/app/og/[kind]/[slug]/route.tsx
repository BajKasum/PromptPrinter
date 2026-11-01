import { ImageResponse } from "next/og";
import { slugFromSegment, socialCardFor } from "@/features/marketing/lib/social-card";

// Die Vorschaukarte einer Hilfe- oder Vergleichsseite, im Aufbau der Karte aus app/opengraph-image.tsx, mit dem
// Titel der Seite statt des Slogans (#253). Edge aus demselben Grund wie dort: der Node-Build von @vercel/og
// scheitert unter Windows an einer verstümmelten file://-Adresse.
export const runtime = "edge";

const SIZE = { width: 1200, height: 630 };

// Wie in opengraph-image.tsx: kein siteUrl(), das Modul hat einen window-Zweig, den die Edge-Runtime nicht braucht.
function displayHost(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) return "localhost:3000";
  return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; slug: string }> }
) {
  const { kind, slug } = await params;
  const card = socialCardFor(kind, slugFromSegment(slug));
  if (!card) return new Response("Not found", { status: 404 });

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
            {card.label}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: card.title.length > 48 ? 56 : 72,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: "#E8EBEF",
          }}
        >
          {card.title}
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
          <div style={{ display: "flex" }}>{displayHost()}</div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      // Der Standard ist ein Jahr, unveränderlich. Ein Titel kann sich ändern, die Karte soll ihm folgen.
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
    }
  );
}
