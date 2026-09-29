import type { MetadataRoute } from "next";
import { siteUrl } from "@/shared/lib/site-url";

// Marketing pages are crawlable; the authenticated app and API are not.
//
// The sitemap URL used to hardcode "https://promptprinter.app" — a domain
// that isn't actually assigned yet (CLAUDE.md: appHost in legal.ts is still a
// placeholder pending the hosting decision), so this pointed a crawler at a
// domain nobody serves this app from. siteUrl() is the same canonical-origin
// helper the auth-redirect links already use (Security-Audit finding L-6);
// reusing it means there's one place that knows the app's real origin, not a
// second hardcoded copy that can silently drift once hosting is decided.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Die ganze eingeloggte App. /admin leitet seit 2026-09-29 auf /usage
      // um, bleibt aber gelistet, damit ein Crawler die alte Adresse gar
      // nicht erst anfragt. /prompts fehlte hier bislang, obwohl es dieselbe
      // auth-gated Fläche ist. robots.txt macht die Pfade nicht unsichtbar,
      // hält brave Crawler aber davon ab, sie zu indexieren.
      disallow: [
        "/api/",
        "/chats",
        "/projects",
        "/prompts",
        "/settings",
        "/usage",
        "/billing",
        "/admin",
      ],
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
