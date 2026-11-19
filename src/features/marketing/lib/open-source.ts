// Wo der Code von PromptPrinter liegt und was es kostet, an einer Stelle für alle öffentlichen Seiten, die darauf
// verweisen (Landing, Über-Seite, /open-source, /terminal, der Hilfe-Artikel "Selbst betreiben", Footer, Structured
// Data, llms.txt). Die Web-App steht unter der MIT-Lizenz; Name, Logo und die Bilder von Finn sind ausgenommen, das
// sagt das README des Repos.

export const REPO_URL = "https://github.com/BajKasum/PromptPrinter";

/** Die Lizenzdatei im Repo. */
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;

/** Die ausführliche Anleitung zum Selbstbetrieb: docs/SETUP.md, Abschnitt "Selbst betreiben". */
export const SELF_HOSTING_GUIDE_URL = `${REPO_URL}/blob/main/docs/SETUP.md#selbst-betreiben`;

/** Der Hilfe-Artikel auf der Seite selbst, die Kurzfassung der Anleitung. */
export const SELF_HOSTING_DOC_PATH = "/docs/selbst-betreiben";

/** Der eine Satz, der sagt, was PromptPrinter kostet: Structured Data und llms.txt. */
export const FREE_OFFER_TEXT =
  "Kostenlos und Open Source. Drei Prompts gehen auf mich, danach chattest du mit deinem eigenen KI-Key.";
