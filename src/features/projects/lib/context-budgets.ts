// Wie viel von den Dateien und dem Repository eines Projekts an das Modell geht. Eine Stelle für den Code, der die
// Grenzen durchsetzt (project-context.ts, brain-sources.ts), und für die Hilfe (/docs/dateien), die sie nennt. Ohne
// Abhängigkeiten, damit die Seite die Zahlen liest, ohne den Server-Code mitzuziehen.

// Die Dateien teilen sich ein Budget im Kontext jedes Chat-Zugs (REDESIGN.md §7): .md zuerst, danach in der
// Reihenfolge des Hochladens. Je Datei gilt eine eigene Grenze, damit eine grosse Datei den Rest nicht verdrängt; was
// nicht mehr passt, wird noch beim Namen genannt. Jedes Zeichen hier kostet bei JEDEM Zug eines Projekt-Chats.
export const FILES_TOTAL_BUDGET = 12000;
export const FILES_PER_FILE_CAP = 3000;

// Mit Projekt-Gedächtnis sinken beide, das ist der Kostengewinn des Features: welcher Stack hier läuft, ist dann
// einmal abgeleitet und steht als Block von höchstens BRAIN_PROMPT_BUDGET Zeichen (shared/lib/project-brain.ts) bereit.
// Die Dateien bleiben trotzdem drin, sie tragen mehr als Stack-Fakten, etwa eine API-Doku oder eine
// Anforderungsliste, an die sich das Gedächtnis nicht erinnern soll.
export const FILES_TOTAL_BUDGET_WITH_BRAIN = 6000;
export const FILES_PER_FILE_CAP_WITH_BRAIN = 2000;

// Die Analyse für das Gedächtnis liest um ein Vielfaches mehr: sie läuft EINMAL, und danach reist nur ihr Ergebnis
// mit jedem Zug, nicht die Rohdateien.
export const ANALYSIS_TEXT_TOTAL_BUDGET = 60000;
export const ANALYSIS_TEXT_PER_FILE_BUDGET = 12000;

/**
 * Wie viele Screenshots in eine Analyse gehen.
 *
 * Bilder sind der teuerste Teil einer Analyse (sie reisen als Base64 im Request und werden vom Anbieter nach
 * Pixelfläche abgerechnet), und der Grenznutzen fällt schnell: der dritte Screenshot derselben App zeigt dieselbe
 * Design-Sprache wie der erste. Drei ist die Zahl, bei der noch Übersicht, Detailseite und Formular hineinpassen.
 */
export const MAX_ANALYSIS_IMAGES = 3;
