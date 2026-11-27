import { renderSocialCard, SOCIAL_CARD_SIZE } from "@/features/marketing/lib/social-card-image";

// Die Karte läuft auf der Edge-Runtime: der Node-Build von @vercel/og sucht seine Schrift und sein WASM über
// path.join(import.meta.url, …), das unter Windows aus der file://-Adresse eine ungültige macht, und
// `next build` bricht beim Vorrendern mit "Invalid URL" ab.
export const runtime = "edge";

// Die Karte der Startseite beim Teilen. Next trägt sie selbst in die OpenGraph- und Twitter-Angaben des
// Root-Layouts ein, mit einer Prüfsumme in der Adresse. Die richtet sich nur nach dieser Datei: ändert sich allein
// das Aussehen in social-card-image.tsx, bleibt die Adresse, und wer Bilder nach Adresse zwischenspeichert, zeigt
// länger das alte.
export const alt = "PromptPrinter, Aus deiner Idee der fertige Prompt";
export const size = SOCIAL_CARD_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderSocialCard({
    label: "v2.0 Beta",
    title: { lead: "Aus deiner Idee\u00a0", highlight: "der fertige Prompt." },
  });
}
