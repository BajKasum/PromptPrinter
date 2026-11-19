// Die Adressen rund um "kostenlos und Open Source" an einer Stelle: die Seite /open-source, der Footer, die
// Structured Data (organization.sameAs in site-schema.ts) und llms.txt lesen sie von hier.

/** Das Repository dieser App. */
export const REPO_URL = "https://github.com/BajKasum/PromptPrinter";

/** Die Lizenz (MIT) im Repository. Name, Logo und die Bilder von Finn sind ausgenommen, das sagt die README. */
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;

/** Die Anleitung "Selbst betreiben" in docs/SETUP.md, auf GitHub gerendert. */
export const SELF_HOSTING_GUIDE_URL = `${REPO_URL}/blob/main/docs/SETUP.md#selbst-betreiben`;

/** Der eine Satz, der sagt, was PromptPrinter kostet: Structured Data und llms.txt. */
export const FREE_OFFER_TEXT =
  "Kostenlos und Open Source. Drei Prompts gehen auf mich, danach chattest du mit deinem eigenen KI-Key.";
