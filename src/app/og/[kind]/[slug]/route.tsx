import { slugFromSegment, socialCardFor } from "@/features/marketing/lib/social-card";
import { renderSocialCard } from "@/features/marketing/lib/social-card-image";

// Die Vorschaukarte einer Hilfe-, Vergleichs- oder Aufgabenseite: die Karte der Startseite mit dem Titel der Seite
// statt des Slogans. Edge aus demselben Grund wie in app/opengraph-image.tsx.
export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; slug: string }> }
) {
  const { kind, slug } = await params;
  const card = socialCardFor(kind, slugFromSegment(slug));
  if (!card) return new Response("Not found", { status: 404 });

  return renderSocialCard({
    label: card.label,
    title: card.title,
    // Beim Standard von next/og (max-age=0) fragt jeder Aufruf neu an. Ein Titel kann sich ändern, die Karte
    // soll ihm folgen, aber nicht jedes Mal neu gezeichnet werden: eine Stunde im Browser, ein Tag im CDN.
    headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
