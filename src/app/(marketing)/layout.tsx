import { Navbar } from "@/features/marketing/components/navbar";
import { Footer } from "@/features/marketing/components/footer";

// Die Hülle der öffentlichen Website: eine Navbar, ein Footer, ein <main>.
//
// Vorher gab es diese fünf Zeilen dreimal in drei Ausprägungen — fünf Seiten
// bauten sie von Hand nach, LegalShell hatte ihre eigene Kopie, DocsShell noch
// eine. Navbar und Footer hatten dadurch je sieben Aufrufer statt einem, und
// jede Änderung an der öffentlichen Hülle (Nav-Punkt, Cookie-Hinweis,
// Skip-Link, Analytics) war eine Änderung an bis zu sieben Stellen mit der
// Möglichkeit, eine zu vergessen. Genau dieser Fehlertyp ist in diesem Projekt
// schon zweimal aufgetreten (Sidebar Desktop/Mobile, zwei api-problem-Kopien).
//
// Der Skip-Link bleibt unberührt: er steht in der Navbar und zeigt auf
// #main-content, und dieses Ziel setzt weiterhin jede Seite selbst auf ihren
// ersten Inhaltsabschnitt (Hero, PageHeader, LegalShell, DocsShell). Die
// Navbar liegt innerhalb von <main>, deshalb kann der Anker nicht auf <main>
// selbst sitzen — er würde den Fokus vor die Navigation setzen statt dahinter.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative">
      <Navbar />
      {children}
      <Footer />
    </main>
  );
}
