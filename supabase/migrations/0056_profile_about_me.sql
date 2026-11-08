-- PromptPrinter — "Über mich": was Finn über die Person wissen soll
--
-- Ein freiwilliges Textfeld in den Einstellungen (Beruf, Sprache, welche KI sie meistens nutzt, bevorzugter Ton).
-- Der Chat gibt es jedem Zug als eigenen, gekennzeichneten Block mit (app/api/chat/turn.ts, shared/lib/about-me.ts).
--
-- Der Browser schreibt die Spalte direkt (features/settings/components/about-me.tsx), deshalb steht die Längengrenze hier und
-- nicht nur im Formular: 1000 Zeichen, dieselbe Zahl wie ABOUT_ME_MAX_LENGTH. Leer heisst "nichts angegeben".
--
-- Rechte: profiles hat seit 0014 eine Positivliste für UPDATE; about_me kommt dazu. Lesen deckt die bestehende
-- Policy profiles_self_select. Export und Löschen: der Export liest die Spalte mit (server/account-export.ts), das
-- Löschen des Kontos nimmt die Zeile per Fremdschlüssel mit.
--
-- Rückgängig:
--   revoke update (about_me) on public.profiles from authenticated;
--   alter table public.profiles drop constraint if exists profiles_about_me_len;
--   alter table public.profiles drop column if exists about_me;
--
-- Wiederholbar: jeder Schritt prüft, ob er schon gelaufen ist.

alter table public.profiles
  add column if not exists about_me text not null default '';

alter table public.profiles drop constraint if exists profiles_about_me_len;
alter table public.profiles
  add constraint profiles_about_me_len check (char_length(about_me) <= 1000);

grant update (about_me) on public.profiles to authenticated;
