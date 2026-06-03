import type { MetadataRoute } from "next";

// Marketing pages are crawlable; the authenticated app and API are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/projects",
        "/generations",
        "/library",
        "/settings",
        "/billing",
        "/new",
      ],
    },
    sitemap: "https://promptprinter.app/sitemap.xml",
  };
}
