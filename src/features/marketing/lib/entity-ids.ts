import { siteUrl } from "@/shared/lib/site-url";

/** Wo der Autor vorgestellt wird. Byline und JSON-LD zeigen auf dieselbe Seite. */
export const AUTHOR_PATH = "/ueber";

/**
 * Die festen `@id` der Knoten, die mehrere Seiten gemeinsam nutzen (#248). Wer eine Organisation, den Autor oder
 * die Website nennt, nennt sie unter dieser Adresse, damit ein Parser die Treffer als dieselbe Sache erkennt und
 * nicht nur an gleichen Namen. Die Adressen werden nie abgerufen, sie sind Namen.
 */
export function entityIds() {
  const base = siteUrl();
  return {
    organization: `${base}/#organization`,
    website: `${base}/#website`,
    software: `${base}/#software`,
    person: `${base}${AUTHOR_PATH}#person`,
  };
}
