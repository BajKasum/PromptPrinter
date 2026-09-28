/**
 * Renders one schema.org JSON-LD block. `<script type="application/ld+json">`
 * isn't executable script — browsers never run it, and CSP's script-src
 * doesn't gate non-executable script types — so this needs no nonce, unlike
 * next-themes' anti-flash script (see root layout's own comment on that).
 * `<` is escaped so a value containing "</script" can't close the tag early;
 * `JSON.stringify` alone doesn't do that.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
