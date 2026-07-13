import type { MetadataRoute } from "next";

// Marketing pages are crawlable; the authenticated app and API are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/chats", "/projects", "/settings", "/billing"],
    },
    sitemap: "https://promptprinter.app/sitemap.xml",
  };
}
