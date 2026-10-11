<div align="center">

<img src="docs/images/logo.png" alt="Finn, der Delfin von PromptPrinter" width="120" />

# PromptPrinter

**Beschreib deine Idee. Finn schreibt dir den Prompt.**

Für jede KI und jede Aufgabe: ein Dokument, eine Webseite, eine Datenbank, eine
Sicherheitsprüfung. Finn fragt kurz nach, was fehlt, und liefert dir den
fertigen Prompt.

[**promptprinter.app**](https://promptprinter.app)

[![Live](https://img.shields.io/badge/live-promptprinter.app-2f6a9e?style=flat-square)](https://promptprinter.app)
[![CI](https://img.shields.io/github/actions/workflow/status/BajKasum/PromptPrinter/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/BajKasum/PromptPrinter/actions/workflows/ci.yml)
[![Lizenz](https://img.shields.io/badge/lizenz-all%20rights%20reserved-lightgrey?style=flat-square)](LICENSE)

</div>

<p align="center">
  <img src="docs/images/landing.png" alt="Die Startseite von PromptPrinter mit Finn und einem Beispiel-Prompt" width="860" />
</p>

## Was ist PromptPrinter?

Die meisten Prompts scheitern daran, dass etwas Wichtiges fehlt: für wen es
ist, in welchem Format, was die KI nicht tun soll. Die KI fragt nicht, sie rät.
Jede falsche Annahme kostet eine Korrekturrunde, und je nach Tool auch Credits.

PromptPrinter setzt einen Schritt davor. Du erzählst Finn, was du brauchst. Er
stellt **eine** gebündelte Rückfrage, nur zu dem, was für deine Aufgabe zählt, und
schreibt dir danach einen Prompt, der für sich steht.

1. **Beschreiben**, so grob, wie es gerade ist.
2. **Eine Rückfrage beantworten**, zum Beispiel wer den Text liest, welche Technik
   dahintersteckt oder wie weit die Aufgabe reicht.
3. **Prompt kopieren** und in die KI deiner Wahl einfügen.

## Funktionen

- **Rückfrage statt Raten.** Finn fragt nur, was für deine Aufgabe zählt, und
  lässt Offenes als sichtbare Lücke stehen, statt etwas zu erfinden.
- **Für jede KI.** Der Prompt läuft in jeder KI, die Text annimmt. Sagst du Finn,
  für welche er gedacht ist, schneidet er ihn darauf zu. Nach jeder Änderung
  bekommst du den ganzen Prompt neu, nie nur einen Ausschnitt.
- **Fotos und Dateien anhängen.** Ein Screenshot oder eine Anforderungsliste an
  die Nachricht, Finn sieht sie und baut den Prompt darauf. Die Anhänge bleiben
  im Chat.
- **Projekte.** Anweisungen, Struktur, Dateien und mehrere Chats an einem Ort,
  damit du nicht in jedem Chat von vorn erklärst.
- **Projekt-Gedächtnis.** Dateien oder ein öffentliches GitHub-Repo einmal
  analysieren lassen. Finn kennt danach Framework, Datenbank, Design-System und
  Konventionen.
- **Prompts speichern.** Gute Prompts im Projekt sichern, als Markdown oder (Pro)
  als PDF exportieren.
- **Sprachmodus.** Idee einsprechen statt tippen.
- **Eigener API-Key.** Anthropic, OpenAI, Gemini oder jeder OpenAI-kompatible
  Endpunkt. Mit eigenem Key ist der Free-Plan gratis, [Pro](https://promptprinter.app/pricing)
  läuft ohne.
- **Fünf Sprachen.** Die App gibt es auf Deutsch, Englisch, Französisch,
  Italienisch und Spanisch, in hell und dunkel.

## Tech-Stack

**Next.js 15** · **React 19** · **TypeScript** (strict) · **Supabase** (Auth,
Postgres, Row-Level-Security) · **Tailwind** · **Framer Motion** · **Vitest** ·
**Vercel**

Dazu Z.ai (GLM) und Gemini als Modelle, Lemon Squeezy für Zahlungen und Upstash
für das Rate-Limiting. Über 1.200 Tests, dazu Guard-Tests, die Schichtgrenzen,
Routen, Kontraste und SEO-Metadaten festhalten.

Setup, Deploy-Checkliste und Projektstruktur stehen in
[docs/SETUP.md](docs/SETUP.md), die Design-Regeln in [docs/DESIGN.md](docs/DESIGN.md).

## Lizenz

Der Quellcode ist **nur zum Ansehen** veröffentlicht. Nutzen, Kopieren, Verändern
und Weitergeben sind nicht erlaubt. Die Details stehen in [LICENSE](LICENSE).

<div align="center">

Gebaut von [Kasum Bajrami](https://github.com/BajKasum) in Basel.

</div>
