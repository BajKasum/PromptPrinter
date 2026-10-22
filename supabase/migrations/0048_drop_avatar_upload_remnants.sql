-- PromptPrinter — Reste des entfernten Profilbild-Uploads abräumen (Issue #158)
-- Run AFTER 0047_billing_events_user_index.sql.
--
-- Der Upload ist seit Anfang Oktober 2026 entfernt (`avatar-upload.tsx` gibt es
-- nicht mehr, nichts liest `profiles.avatar_url`). Seine Rechte blieben:
--
--   * Bucket `avatars` ist öffentlich (0006), 2 MB, Bilder (0027).
--   * `avatars_owner_insert` / `avatars_owner_update` lassen jedes angemeldete
--     Konto unter `{uid}/avatar` hochladen und überschreiben. Das ist kostenlose,
--     öffentlich erreichbare Bildablage auf der Supabase-Domain des Projekts,
--     die die App nie anzeigt und die dem Projekt zugerechnet würde.
--   * `profiles.avatar_url` ist für `authenticated` beschreibbar (0014).
--
-- Was keine Funktion mehr hat, hat auch keine Rechte mehr. Geprüft am 23.10.2026
-- gegen die Produktion (lesend): ein Objekt im Bucket (das eine, das vor 0027
-- entstand), eine Zeile mit gesetztem `avatar_url`, vier Policies auf dem Bucket.
--
-- 1) Schreiben nicht mehr erlaubt: Insert- und Update-Policy weg.
drop policy if exists avatars_owner_insert on storage.objects;
drop policy if exists avatars_owner_update on storage.objects;

-- 2) Select- und Delete-Policy bleiben, mit Absicht. Das Löschen eines Kontos
--    räumt `{uid}/avatar` weiterhin weg (`src/app/api/account/route.ts`, ein
--    Aufruf ohne Treffer ist folgenlos), und ein Besitzer kann ein Altobjekt
--    selbst entfernen.
--
-- 3) Bucket privat. Ein öffentlicher Bucket liefert jedes Objekt an jeden aus,
--    ohne RLS; das eine Altobjekt ist damit nicht mehr abrufbar. Das Objekt
--    selbst bleibt liegen (Datenbestand, nicht diese Migration), es verschwindet
--    mit dem Konto.
update storage.buckets
set public = false
where id = 'avatars';

-- 4) Die Spalte bleibt (Datenbestand, Export), ist aber nicht mehr schreibbar.
--    0014 vergab die Rechte spaltenweise (`grant update (display_name,
--    avatar_url, settings)`), deshalb wirkt der Entzug pro Spalte.
revoke update (avatar_url) on public.profiles from authenticated;
