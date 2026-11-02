-- PromptPrinter — Terminal-Sitzungen sichtbar, einzeln widerrufbar, mit Höchstalter
--
-- Entscheid (docs/SETUP.md, "Terminal-Anmeldung"): das Terminal behält eine echte Supabase-Sitzung, es gibt keinen
-- eigenen Token-Typ. Damit sie beherrschbar ist, führt diese Tabelle jede ausgestellte Sitzung.
--
--   session_id    auth.sessions.id, im JWT der Claim session_id. Der Fremdschlüssel räumt den Eintrag mit der Sitzung
--                 weg: Abmelden im Terminal, Abmelden überall, Löschen des Kontos.
--   client_name   wie sich das Gerät genannt hat, bis 60 Zeichen. Wird nur angezeigt.
--   expires_at    Höchstalter, vom Server beim Ausstellen gesetzt (CLI_SESSION_MAX_AGE_MS). Time-box von Supabase Auth
--                 gibt es erst im Pro-Tarif, und eine Prüfung nur in der App hülfe nicht: Refresh-Token und Anon-Key
--                 reichen, um eine Sitzung direkt bei Supabase zu verlängern. Deshalb beendet ein Job in der Datenbank
--                 jede abgelaufene Sitzung, wer auch immer sie benutzt.
--   last_used_at  grob, höchstens alle 15 Minuten geschrieben.
--
-- Dazu kommen drei Spalten an cli_device_requests: von welcher Adresse, ungefähr woher und mit welchem Programm die
-- Anfrage kam. Die Bestätigungsseite zeigt sie (RFC 8628, Abschnitt 5.4: Schutz gegen untergeschobene Codes). Sie
-- leben so kurz wie die Anfrage: höchstens einen Tag über ihren Ablauf hinaus.
--
-- Nur der Server (Service-Role) liest und schreibt. end_cli_session beendet nur eine eingetragene Sitzung des genannten
-- Kontos und kann deshalb keine Sitzung eines Browsers treffen.
--
-- Rückgängig:
--   select cron.unschedule('prune-cli-login');
--   drop function if exists public.prune_cli_login();
--   drop function if exists public.end_cli_session(uuid, uuid);
--   drop table if exists public.cli_sessions;
--   alter table public.cli_device_requests drop column if exists request_ip,
--     drop column if exists request_location, drop column if exists request_user_agent;
-- Der Code unter src/app/api/cli/ antwortet dann mit 503, der Chat weist Terminals ab, der Rest der App merkt nichts.
--
-- Wiederholbar: jeder Schritt prüft, ob er schon gelaufen ist.

alter table public.cli_device_requests
  add column if not exists request_ip text,
  add column if not exists request_location text,
  add column if not exists request_user_agent text;

alter table public.cli_device_requests drop constraint if exists cli_device_requests_request_context_len;
alter table public.cli_device_requests add constraint cli_device_requests_request_context_len check (
  coalesce(char_length(request_ip), 0) <= 64
  and coalesce(char_length(request_location), 0) <= 120
  and coalesce(char_length(request_user_agent), 0) <= 120
);

create table if not exists public.cli_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  constraint cli_sessions_client_name_len check (char_length(client_name) <= 60)
);

create index if not exists cli_sessions_user_idx on public.cli_sessions (user_id, created_at desc);
create index if not exists cli_sessions_expires_idx on public.cli_sessions (expires_at);

alter table public.cli_sessions enable row level security;

drop policy if exists cli_sessions_no_client_access on public.cli_sessions;
create policy cli_sessions_no_client_access on public.cli_sessions
  for all to anon, authenticated
  using (false)
  with check (false);

revoke all on public.cli_sessions from anon, authenticated;
grant select, insert, update, delete on public.cli_sessions to service_role;

-- Löscht die Sitzung bei Supabase Auth: mit ihr gehen die Refresh-Tokens und über den Fremdschlüssel der Eintrag oben.
-- getUser() scheitert danach sofort. Ein schon ausgestelltes Access-Token gilt an der Data API bis zu seinem Ablauf
-- weiter (höchstens eine Stunde), das lässt sich bei einem signierten Token nicht ändern.
create or replace function public.end_cli_session(target_session uuid, target_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.sessions s
  using public.cli_sessions c
  where s.id = target_session
    and c.session_id = s.id
    and c.user_id = target_user;
  return found;
end;
$$;

revoke execute on function public.end_cli_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.end_cli_session(uuid, uuid) to service_role;

-- Beendet abgelaufene Terminal-Sitzungen und löscht Anfragen, die länger als einen Tag abgelaufen sind (mit ihnen Adresse
-- und Programm). Das Anlegen einer Anfrage räumt auch auf, aber nur, wenn jemand eine anlegt.
create or replace function public.prune_cli_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.sessions s
  using public.cli_sessions c
  where c.session_id = s.id
    and c.expires_at < now();
  delete from public.cli_device_requests where expires_at < now() - interval '1 day';
end;
$$;

revoke execute on function public.prune_cli_login() from public, anon, authenticated;
grant execute on function public.prune_cli_login() to service_role;

-- Stündlich: das Höchstalter hält damit auf eine Stunde genau, und ein Access-Token gilt ohnehin eine Stunde.
-- pg_cron kommt aus der Migration des Sicherheitsprotokolls.
select cron.schedule('prune-cli-login', '7 * * * *', 'select public.prune_cli_login()');
