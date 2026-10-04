-- PromptPrinter — set_active_byok_provider() nicht mehr für anon aufrufbar
-- Run AFTER 0045_chat_attachments.sql.
--
-- Gefunden im Betriebs-Audit vom 04.10.2026: von den Funktionen im
-- public-Schema war genau eine für `anon` ausführbar,
-- set_active_byok_provider(text). Dieselbe Ursache wie bei 0032 und
-- project_summaries(): 0030 schrieb nur `grant execute ... to authenticated`,
-- aber CREATE FUNCTION gibt EXECUTE an PUBLIC, solange die Migration es nicht
-- vorher entzieht, und jede Rolle (anon eingeschlossen) gehört implizit zu
-- PUBLIC.
--
-- Folgenlos, vor dem Schreiben geprüft: die Funktion ist `security invoker`
-- und filtert `where user_id = auth.uid()`. Für einen anonymen Aufrufer ist das
-- NULL, es trifft also keine Zeile; dazu hat anon auf user_api_keys gar keine
-- Rechte. Das hier schliesst ein unnötiges Recht, keine offene Lücke.
--
-- Der neue Guard in tests/guards/migrations.test.ts hält diese Klasse künftig
-- fest: jede an `authenticated` vergebene Funktion muss irgendwo von PUBLIC
-- entzogen werden. Ohne ihn ist dies das zweite Mal, dass jemand erst beim
-- Nachmessen davon erfährt.
revoke execute on function public.set_active_byok_provider(text) from public, anon;

-- Das Recht für angemeldete Nutzer erneut ausdrücklich setzen, damit diese
-- Migration für sich genommen ein vollständiges, richtiges Bild des gewollten
-- Rechts ist (wie 0032).
grant execute on function public.set_active_byok_provider(text) to authenticated;
