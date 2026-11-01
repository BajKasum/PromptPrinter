import { buildSecurityTxt } from "./build-security-txt";

// Statisch: `Expires` steht beim Build fest, jeder Deploy schiebt es weiter.
export const dynamic = "force-static";

export function GET() {
  return new Response(buildSecurityTxt(new Date()), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
