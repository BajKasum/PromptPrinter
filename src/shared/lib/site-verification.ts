import type { Metadata } from "next";

/**
 * Inhaber-Nachweis für Google Search Console und Bing Webmaster Tools.
 *
 * Beide Dienste zeigen erst dann, wie die Seite in der Suche abschneidet
 * (Suchanfragen, indexierte Seiten, Crawl-Fehler, Sitemap-Status), wenn
 * bewiesen ist, dass man die Seite kontrolliert. Der Weg ohne DNS-Zugriff ist
 * ein Meta-Tag im `<head>` der Startseite, dessen Wert der jeweilige Dienst
 * vorgibt.
 *
 * Der Wert kommt aus der Umgebung statt aus dem Code, damit ein Fork oder ein
 * Vorschau-Deployment sich nicht als Inhaber dieser Property ausgibt. Er ist
 * kein Geheimnis (er steht für jeden lesbar im HTML), trägt aber bewusst kein
 * `NEXT_PUBLIC_`: gelesen wird er nur hier, beim Bauen des Root-Layouts.
 *
 * Nicht gesetzt heisst kein Tag. Das Root-Layout ist statisch, eine neue
 * Variable wirkt deshalb erst nach einem neuen Deployment.
 */
export function siteVerification(
  env: Record<string, string | undefined> = process.env
): Metadata["verification"] {
  const google = env.GOOGLE_SITE_VERIFICATION?.trim();
  const bing = env.BING_SITE_VERIFICATION?.trim();
  if (!google && !bing) return undefined;

  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}
