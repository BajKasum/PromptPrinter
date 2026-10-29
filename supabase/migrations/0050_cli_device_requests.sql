-- PromptPrinter — Anmeldung der Kommandozeile per Geräte-Code
-- Run AFTER 0049_saved_prompts.sql.
--
-- Die Terminal-App hat kein Cookie und kein Passwortfeld. Sie fragt den Server nach einem Geräte-Code,
-- der Nutzer bestätigt den kurzen Nutzer-Code im Browser (eingeloggt), danach holt die Kommandozeile
-- einmal eine eigene Sitzung ab (src/app/api/cli/). Diese Tabelle hält die Anfragen dazwischen, höchstens
-- zehn Minuten lang.
--
--   device_code_hash  SHA-256 des Geräte-Codes. Der Code selbst (32 Byte Zufall) wird nie gespeichert,
--                     wer die Tabelle liest, kann damit keine Sitzung abholen.
--   user_code         acht Zeichen ohne Vokale und ohne Verwechselbares (kein 0, 1, I, O), wird im Browser
--                     abgetippt. Nie über einen Link vorausgefüllt (src/features/auth/).
--   client_name       wie sich das Gerät nennt, bis 60 Zeichen. Die Bestätigungsseite zeigt ihn an; er wird
--                     nirgends als vertrauenswürdig behandelt.
--   status            pending -> approved | denied -> consumed. Das Abholen setzt von approved auf
--                     consumed in EINEM Update (and status = 'approved'), so bekommt nur ein Aufruf die
--                     Sitzung.
--   user_id           erst gesetzt, wenn jemand entschieden hat (pending hat keinen Nutzer).
--   last_polled_at    wann die Kommandozeile zuletzt nachgefragt hat, für die Abfragepause.
--
-- Nur der Server (Service-Role) liest und schreibt. anon und authenticated bekommen KEIN Recht, und die
-- Policy erlaubt ihnen ausdrücklich nichts: eine Tabelle mit RLS und ganz ohne Policy ist dasselbe, aber
-- sie liest sich wie ein Versehen (der Advisor meldet sie auch so). Neue gespeicherte Daten: Gerätename
-- und Zeitpunkte, kein neuer Empfänger. Mit dem Konto verschwinden die Zeilen (on delete cascade).
--
-- Rückgängig: `drop table if exists public.cli_device_requests;` (die Tabelle hält nur kurzlebige
-- Anfragen, nichts davon ist Nutzerinhalt). Der Code unter src/app/api/cli/ antwortet dann mit 503.
--
-- Wiederholbar: jeder Schritt prüft, ob er schon gelaufen ist.

create table if not exists public.cli_device_requests (
  id uuid primary key default gen_random_uuid(),
  device_code_hash text not null unique,
  user_code text not null unique,
  client_name text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'consumed')),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  last_polled_at timestamptz,
  constraint cli_device_requests_hash_format check (device_code_hash ~ '^[0-9a-f]{64}$'),
  constraint cli_device_requests_user_code_format check (user_code ~ '^[BCDFGHJKLMNPQRSTVWXZ2-9]{8}$'),
  constraint cli_device_requests_client_name_len check (char_length(client_name) <= 60),
  constraint cli_device_requests_user_by_status check ((status = 'pending') = (user_id is null))
);

-- Aufräumen läuft über expires_at, und der Fremdschlüssel auf auth.users bekommt seinen Index, sonst wird
-- jedes Löschen eines Kontos zum Vollscan dieser Tabelle (wie 0047).
create index if not exists cli_device_requests_expires_idx
  on public.cli_device_requests (expires_at);
create index if not exists cli_device_requests_user_idx
  on public.cli_device_requests (user_id)
  where user_id is not null;

alter table public.cli_device_requests enable row level security;

drop policy if exists cli_device_requests_no_client_access on public.cli_device_requests;
create policy cli_device_requests_no_client_access on public.cli_device_requests
  for all to anon, authenticated
  using (false)
  with check (false);

-- Die Rechte ausdrücklich, nicht den Standardrechten überlassen (wie billing_events in 0039).
revoke all on public.cli_device_requests from anon, authenticated;
grant select, insert, update, delete on public.cli_device_requests to service_role;
