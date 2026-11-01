import { LEGAL } from "@/shared/lib/legal";

const POLICY_URL = "https://github.com/BajKasum/PromptPrinter/blob/main/SECURITY.md";
const VALID_DAYS = 365;

/** Der Kontakt für Sicherheitsmeldungen nach RFC 9116; dieselbe Adresse wie SECURITY.md (shared/lib/legal.ts). */
export function buildSecurityTxt(now: Date): string {
  const expires = new Date(now.getTime() + VALID_DAYS * 24 * 60 * 60 * 1000);
  return [
    `Contact: mailto:${LEGAL.email}`,
    `Expires: ${expires.toISOString()}`,
    `Policy: ${POLICY_URL}`,
    "Preferred-Languages: de, en",
    "",
  ].join("\n");
}
