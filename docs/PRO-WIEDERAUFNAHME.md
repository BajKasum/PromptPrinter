# Pro wieder aufnehmen

Stand: **Pro ist seit 2026-10-17 nicht kaufbar** (Entscheid Kasum). Dieses Dokument sagt, warum,
was im Code liegen geblieben ist und was zu tun ist, wenn Pro wieder aufgenommen wird.

**Auslöser, wenn Kasum eine neue Sitzung startet:** "Nimm die Pro-Seite wieder auf, ich habe jetzt
den Vercel-Pro-Plan" (oder sinngemäss). Dann dieses Dokument von oben nach unten abarbeiten.

## Warum aus

Vercel Hobby ist laut den [Fair-Use-Regeln von Vercel](https://vercel.com/docs/limits/fair-use-guidelines)
auf nicht-kommerzielle Nutzung beschränkt; "any method of requesting or processing payment from
visitors" zählt als kommerziell. Mit einem Kaufknopf liegt das Projekt darüber. Der Pro-Plan von
Vercel (rund 20 $ im Monat, Preis vor der Buchung nachsehen) ist noch nicht gebucht. Bis dahin
führt jeder Pro-Knopf auf die Seite `/pro-bald` ("Pro gibt es noch nicht, es tut mir leid ...").

## Was jetzt gilt (und was NICHT gelöscht ist)

- Der Schalter steht in `src/shared/lib/pro-availability.ts`: `PRO_AVAILABLE = false`.
- Alle drei Pro-Einstiege (Preisseite `ProCheckoutCta`, `/plans`, `/billing`) laufen über
  `LemonCheckoutButton` (`src/shared/ui/lemon-checkout-button.tsx`). Ist der Schalter aus, wird dort
  ein Link auf `PRO_UNAVAILABLE_PATH` (`/pro-bald`) gerendert, sonst nichts.
- Die Seite `src/app/(marketing)/pro-bald/page.tsx` ist öffentlich, `noindex`, nicht in der Sitemap.
- **Unverändert im Code:** die Seiten `/plans` und `/billing`, die Preise (`shared/lib/pricing.ts`),
  die Checkout-Adresse (`shared/lib/lemon-squeezy.ts`: ganze Seite von Lemon Squeezy in den Farben
  der App, links Name, Preis und Finn, `presentation: "page"`), der Webhook
  (`/api/webhooks/lemonsqueezy`), das Kundenportal, die Kündigung. Ein bestehender Pro-Nutzer (zum
  Beispiel Admin) behält seinen Plan.
- Der Guard `tests/guards/pro-availability.test.ts` hält Schalter, Seite und dieses Dokument zusammen
  und lässt keinen zweiten Weg am Schalter vorbei zu.

## Voraussetzungen (Kasum)

1. **Vercel Pro gebucht** (Team `bajkasums-projects`). Im Dashboard unter Billing prüfen, nicht raten.
2. **Backup der Datenbank** entscheiden (Supabase Free hat keins, Betriebs-Audit K1). Mit Zahlenden
   wiegt ein Datenverlust schwerer.
3. **Lemon Squeezy:** Produkt "PromptPrinter Pro" hat das Finn-Bild im Format 4:3 (1600 x 1200,
   Hintergrund #EBF4FA; Lemon Squeezy schneidet auf 4:3 zu), die Rückkehr nach dem Kauf zeigt auf
   `https://promptprinter.app/billing`, die Frage brutto oder netto ist beantwortet.
4. **Kosten im Blick:** Pro-Nutzer chatten mit dem Z.ai-Schlüssel auf Kasums Rechnung
   (Tagesbudget und Kontingent prüfen).

## Schritte (Claude)

1. Frischer Branch von `main` (`feat/pro-wieder-an`), Regeln aus CLAUDE.md.
2. `PRO_AVAILABLE = true` in `src/shared/lib/pro-availability.ts`. Kommentar am Schalter anpassen.
3. Die Seite `/pro-bald` auf `/pricing` umleiten (`redirects` in `next.config.ts`) oder löschen.
   Löschen heisst: Ordner, Eintrag in `PUBLIC_PREFIXES` (`src/server/supabase/middleware.ts`) und
   den Guard-Abschnitt in `tests/guards/pro-availability.test.ts` mit entfernen. Der Rest der
   Tests läuft mit dem Mock des Schalters und muss nicht angefasst werden.
4. Dieses Dokument und den Absatz "Pläne" in CLAUDE.md auf "Pro ist kaufbar" ändern, Changelog-Eintrag.
5. Gate, PR, CI, Rebase-Merge, Deploy abwarten.
6. **Live prüfen** (Kasum loggt sich selbst ein): mit einem Free-Konto auf `/plans` "Pro holen":
   öffnet sich die Checkout-Seite von Lemon Squeezy in App-Farben mit Finn links? Mail
   vorausgefüllt? Der **erste echte Kauf** ist der erste Test des Webhooks mit einem echten
   Ereignis (nie gelaufen): danach im Lemon-Squeezy-Dashboard die Webhook-Zustellung und in der
   Datenbank den Plan des Käufers ansehen.
