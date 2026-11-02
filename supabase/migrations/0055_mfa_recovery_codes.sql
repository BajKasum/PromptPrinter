-- PromptPrinter — Wiederherstellungscodes für den zweiten Faktor
--
-- Die TOTP-Anmeldung selbst liegt bei Supabase Auth (auth.mfa_factors), hier steht nur der Rückweg bei Verlust des Geräts.
-- Supabase Auth bringt eigene Codes erst als abgeschaltete Testfunktion mit (Schalter auf dem Server und im Client), auf die
-- sich ein Rückweg aus dem eigenen Konto nicht stützen darf. Deshalb diese Tabelle: wer sein Gerät verliert, meldet sich mit dem
-- Passwort an, löst einen Code ein, und der Server entfernt den Faktor (src/app/api/auth/mfa/route.ts).
--
--   code_hash   SHA-256 aus Konto und Code. Die Codes selbst (rund 77 Bit Zufall) sieht der Nutzer genau einmal, wer die
--               Tabelle liest, kann damit nichts anfangen.
--   used_at     gesetzt, sobald der Code eingelöst ist. Das Einlösen ist ein einziges Update, das nur eine offene Zeile trifft:
--               derselbe Code gilt nur einmal, auch bei zwei gleichzeitigen Anfragen.
--
-- Nur der Server (Service-Role) liest und schreibt. Mit dem Konto verschwinden die Zeilen (on delete cascade).
--
-- Rückgängig: `drop table if exists public.mfa_recovery_codes;` Wer dann sein Gerät verliert, kommt nur noch über den Betreiber
-- zurück (docs/SETUP.md, "Zweiter Faktor").
--
-- Wiederholbar: jeder Schritt prüft, ob er schon gelaufen ist.

create table if not exists public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mfa_recovery_codes_hash_format check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint mfa_recovery_codes_unique unique (user_id, code_hash)
);

alter table public.mfa_recovery_codes enable row level security;

drop policy if exists mfa_recovery_codes_no_client_access on public.mfa_recovery_codes;
create policy mfa_recovery_codes_no_client_access on public.mfa_recovery_codes
  for all to anon, authenticated
  using (false)
  with check (false);

revoke all on public.mfa_recovery_codes from anon, authenticated;
grant select, insert, update, delete on public.mfa_recovery_codes to service_role;
