# Sicherheit

PromptPrinter ist ein Solo-Projekt. Wenn du eine Sicherheitslücke findest, melde sie bitte
privat, bevor du sie veröffentlichst.

## So meldest du eine Lücke

Schreib eine Mail an **kasumbajrami7@gmail.com**, Betreff "Sicherheitslücke PromptPrinter".

Bitte **keine öffentliche Issue und keinen öffentlichen Pull Request** für eine Schwachstelle,
solange sie nicht behoben ist.

Hilfreich ist:

- was betroffen ist: die Adresse, die Seite, die Funktion oder die Datei im Repository
- wie ich es nachstellen kann, Schritt für Schritt
- was jemand damit erreichen könnte
- ein Vorschlag zur Behebung, falls du einen hast

## Was dich erwartet

PromptPrinter entsteht in meiner Freizeit. Ich antworte, so schnell ich kann, rechne mit
einigen Tagen. Eine feste Frist kann ich nicht zusagen. Du bekommst Bescheid, wenn ich deine
Meldung gelesen habe, und noch einmal, wenn die Lücke behoben ist. Es gibt kein
Bug-Bounty-Programm und keine Belohnung. Auf Wunsch nenne ich deinen Namen.

## Was unterstützt wird

Der jeweils aktuelle Stand auf `main`, so wie er unter
[promptprinter.app](https://promptprinter.app) läuft. Ältere Stände werden nicht gepflegt.

## Was im Umfang liegt

Die App unter promptprinter.app und der Code in diesem Repository.

Nicht im Umfang sind die Dienste, auf denen PromptPrinter läuft: Supabase, Vercel, Lemon
Squeezy, Cloudflare, Upstash und die KI-Anbieter. Lücken dort bitte direkt beim jeweiligen
Anbieter melden.

## Regeln beim Testen

- Teste nur mit deinem eigenen Konto und deinen eigenen Daten. Greif nie auf Daten anderer
  Nutzer zu. Siehst du aus Versehen welche, speichere und teile sie nicht und melde es sofort.
- Keine Lasttests, keine Denial-of-Service-Versuche, kein Spam.
- Kein Social Engineering und kein Phishing, auch nicht gegen mich.
- Schick keine ungeprüften Ergebnisse automatischer Scanner. Prüf einen Fund selbst, bevor
  du ihn meldest.

## In English

Please report security vulnerabilities privately by email to **kasumbajrami7@gmail.com**
(subject "Security vulnerability PromptPrinter"), not through a public issue. This is a solo
project run in my spare time: expect a reply within a few days, with no guaranteed deadline
and no bug bounty. In scope are promptprinter.app and the code in this repository. Please test
only with your own account and data, and do not run load tests or denial-of-service attempts.
