import type { MetadataRoute } from "next";
import { APP_PREFIXES } from "@/shared/lib/app-routes";
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
      // Die ganze eingeloggte App, aus derselben Liste wie die Middleware
      // (shared/lib/app-routes.ts). Vorher stand hier eine eigene Kopie, in
      // der /prompts schon einmal fehlte. robots.txt macht die Pfade nicht
      // unsichtbar, hält brave Crawler aber davon ab, sie zu indexieren.
      //
      // Bewusst EINE Gruppe für `*` und keine eigenen Gruppen für GPTBot,
      // ClaudeBot, PerplexityBot und Co.: ein Crawler mit eigener Gruppe
      // ignoriert `*` vollständig, die Disallow-Liste müsste dann pro Bot
      // wiederholt werden. So gilt für KI-Crawler dasselbe wie für Google:
      // alles Öffentliche ist erlaubt.
      disallow: ["/api/", ...APP_PREFIXES],
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
