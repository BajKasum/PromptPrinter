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
      // /admin fehlte hier bislang, obwohl es dieselbe auth-gated
      // App-Only-Fläche ist wie die anderen vier: 404 für alle ausser
      // is_admin=true (admin/page.tsx), "nobody else needs to know exists".
      // robots.txt macht den Pfad nicht unsichtbar, hält brave Crawler aber
      // davon ab, ihn zu indexieren.
      disallow: ["/api/", "/chats", "/projects", "/settings", "/billing", "/admin"],
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
