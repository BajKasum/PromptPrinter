-- PromptPrinter — eine eigene Nachricht darf wieder verschwinden
-- Run AFTER 0039_lemonsqueezy_billing.sql.
--
-- Vorbereitung fuer Planpunkt C-1: die Nutzer-Nachricht wird ab jetzt VOR dem
-- Modellaufruf geschrieben, damit ein geschlossener Tab sie nicht mehr
-- verschluckt. Der Preis dafuer ist ein neuer Fall — scheitert der
-- Anbieter-Aufruf, steht eine Frage ohne Antwort in der Datenbank, waehrend
-- die Oberflaeche sie zurueckrollt und die Eingabe wiederherstellt (so
-- gebaut seit QA-Befund F-4/U-6). Ohne ein Zuruecknehmen liefen Anzeige und
-- Datenbank auseinander: nach einem Reload staende die Frage wieder da, und
-- in der Seitenleiste haenge ein Chat, der nur aus ihr besteht.
--
-- `messages` hatte bis hier ausschliesslich Policies fuer insert und select.
-- Eine einzelne Nachricht war damit unloeschbar; geloescht wurde nur ueber
-- die Konversation (ON DELETE CASCADE). Das war kein Versehen, sondern
-- schlicht der bisherige Bedarf.
--
-- ANMERKUNG ZU EINEM TOTEN GRANT, hier nicht angefasst: `messages` traegt
-- einen update-Grant fuer `authenticated`, aber KEINE update-Policy. RLS
-- verweigert damit jedes UPDATE, der Grant laeuft ins Leere. Das faellt
-- niemandem auf, weil nichts im Code updated. Bewusst stehen gelassen statt
-- nebenbei entfernt: das gehoert in einen eigenen Aufraeum-Schritt mit
-- eigener Pruefung, nicht in eine Migration, die etwas anderes tut. Wer
-- spaeter "Nachricht bearbeiten" baut (Planpunkt C-2), stolpert genau hier
-- und findet diesen Absatz.

drop policy if exists messages_owner_delete on public.messages;
create policy messages_owner_delete on public.messages
  for delete using ((select auth.uid()) = user_id);

-- `(select auth.uid())` statt `auth.uid()`: Hausstandard seit 0035, der
-- Planer wertet den Aufruf damit einmal pro Query statt einmal pro Zeile aus.

grant delete on public.messages to authenticated;
