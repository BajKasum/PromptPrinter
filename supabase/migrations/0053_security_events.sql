-- PromptPrinter — Sicherheitsprotokoll (Ereignisse, die bleiben müssen)
--
-- Das Log von Vercel Hobby hält eine Stunde. Änderungen an eigenen Keys, an der Einwilligung in Z.ai und das Löschen
-- eines Kontos müssen sich auch Wochen später nachvollziehen lassen, etwa nach einer Kontoübernahme oder bei einer
-- bestrittenen Einwilligung. src/server/security/security-events.ts schreibt sie hierher, zusätzlich zum Log.
--
--   event     Name des Vorgangs, zum Beispiel api_key.saved.
--   user_id   Kennung des Kontos. Bewusst OHNE Fremdschlüssel: "Konto gelöscht" muss das Konto überleben. Mit dem
--             Konto verschwinden alle anderen Daten, diese Zeilen bleiben bis zum Ablauf der 180 Tage.
--   details   Kurze Angaben wie der Anbieter, nie eine Adresse, ein Key oder Inhalt (safeSecurityContext prüft das).
--
-- Nur zum Anhängen: anon und authenticated bekommen kein Recht, service_role darf lesen und schreiben, aber weder ändern
-- noch löschen. Auch wer den Service-Role-Schlüssel hat, kann das Protokoll also nicht umschreiben. Löschen kann nur
-- prune_security_events(), und das nur, was älter als 180 Tage ist.
--
-- Der Job läuft in der Datenbank (pg_cron), nicht in der App: das Protokoll soll auch dann aufgeräumt werden, wenn
-- niemand die Seite benutzt, und ein Cron von Vercel bräuchte ein weiteres Secret.
--
-- Rückgängig:
--   select cron.unschedule('prune-security-events');
--   drop function if exists public.prune_security_events();
--   drop table if exists public.security_events;
-- pg_cron darf bleiben, solange kein anderer Job es braucht: drop extension löscht alle Jobs.
--
-- Wiederholbar: jeder Schritt prüft, ob er schon gelaufen ist.

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  user_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint security_events_event_len check (char_length(event) between 1 and 80)
);

-- Aufräumen läuft über created_at, die Suche nach einem Vorfall über das Konto.
create index if not exists security_events_created_idx
  on public.security_events (created_at);
create index if not exists security_events_user_idx
  on public.security_events (user_id, created_at desc)
  where user_id is not null;

alter table public.security_events enable row level security;

drop policy if exists security_events_no_client_access on public.security_events;
create policy security_events_no_client_access on public.security_events
  for all to anon, authenticated
  using (false)
  with check (false);

revoke all on public.security_events from anon, authenticated;
revoke all on public.security_events from service_role;
grant select, insert on public.security_events to service_role;

create or replace function public.prune_security_events()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed bigint;
begin
  delete from public.security_events where created_at < now() - interval '180 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke execute on function public.prune_security_events() from public, anon, authenticated;
grant execute on function public.prune_security_events() to service_role;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Täglich um 03:17 UTC. Der Name macht das wiederholbar: ein zweiter Lauf ersetzt den Job.
select cron.schedule('prune-security-events', '17 3 * * *', 'select public.prune_security_events()');
