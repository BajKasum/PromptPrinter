import type { MetadataRoute } from "next";
import { APP_PREFIXES } from "@/shared/lib/app-routes";
import { siteUrl } from "@/shared/lib/site-url";

// Die öffentlichen Seiten dürfen indexiert werden, die eingeloggte App und die API nicht.
//
// Die Adresse der Sitemap kommt aus siteUrl() wie die Auth-Redirects: eine fest eingetragene Domain zeigte auf
// einer anderen Installation auf eine fremde Seite.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Die ganze eingeloggte App, aus derselben Liste wie der Proxy (shared/lib/app-routes.ts), damit keine zweite
      // Kopie davon abweicht. robots.txt macht die Pfade nicht unsichtbar, hält brave Crawler aber davon ab, sie zu
      // indexieren.
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
