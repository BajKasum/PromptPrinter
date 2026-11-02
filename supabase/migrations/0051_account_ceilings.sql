-- PromptPrinter — Grenzen je Konto und Eigentümer-Prüfung in der Datenbank (#227, #233)
-- Run AFTER 0050_cli_device_requests.sql. Kein Code braucht diese Migration, und sie braucht keinen Code.
--
-- Der Browser hält ein Nutzer-JWT, der anon-Key ist öffentlich: die Tabellen sind über PostgREST und
-- Storage direkt erreichbar, an den API-Routen und ihrem Ratenlimit vorbei. Was überall gelten soll,
-- muss deshalb hier stehen. Die Routen behalten ihre freundliche Absage, sie antworten nur früher.
--
-- GRENZEN (Begründung und Rechnung: docs/SETUP.md, "Grenzen je Konto"; dieselben Zahlen in
-- src/shared/lib/plans.ts, tests/guards/account-ceilings.test.ts hält beide zusammen):
--
--   projects        3 im Plan Free, ohne Grenze für Pro und Admin (PLAN_LIMITS)
--   conversations   10 000 Zeilen
--   messages        50 000 Zeilen, 50 MiB
--   saved_prompts   5 000 Zeilen, 20 MiB
--   project_files   500 Zeilen
--   Bucket project-files  500 Objekte, 100 MiB
--
-- WARUM ZEILEN UND BYTES: eine Nachricht darf 40 000 Zeichen haben, ein gespeicherter Prompt 200 kB.
-- Zeilen allein liessen ein einzelnes Konto die ganze Datenbank füllen. Die Bytes zählt
-- pg_column_size: was wirklich belegt ist (nach Kompression), und es liest die ausgelagerten Werte nicht.
--
-- BESTEHENDE KONTEN verlieren nichts: die Trigger laufen nur beim Einfügen. Wer über einer Grenze
-- liegt, behält alles, kann ändern und löschen und erst wieder anlegen, wenn er darunter ist.
--
-- WARUM NACH DEM BEFEHL UND NICHT JE ZEILE: ein Befehl mit vielen Zeilen zählt so einmal statt
-- einmal je Zeile, und die Policy hat die Zeilen schon geprüft. Die Sperre nimmt also nur das Konto,
-- dem die Zeilen wirklich gehören, nie ein fremdes.
--
-- WARUM DIE SPERRE: zählen und einfügen sind sonst zwei Schritte, und parallele Anfragen kämen
-- gemeinsam durch. pg_advisory_xact_lock reiht die Einfügungen eines Kontos bis zum Commit hintereinander,
-- die Zählung danach ist ein eigener Befehl und sieht, was die anderen schon geschrieben haben.
--
-- security invoker wie 0022 und 0045: die Funktionen laufen als Aufrufer, RLS begrenzt sie zusätzlich
-- auf eigene Zeilen. Über den Service-Role-Client gelten dieselben Grenzen.

-- ─── Zählen je Konto ───────────────────────────────────────────────────────
-- Der Trigger zählt bei jedem Einfügen. Vorhanden war nur ein Teilindex für Antworten.
create index if not exists messages_user_idx on public.messages (user_id);

-- ─── Projekt-Grenze des Plans ──────────────────────────────────────────────
-- Unbekannter Plan zählt als Free, wie toPlanKey() in src/shared/lib/plans.ts.
create or replace function public.enforce_project_cap()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  account uuid;
  account_plan text;
  account_is_admin boolean;
begin
  for account in select distinct user_id from new_rows order by user_id loop
    perform pg_advisory_xact_lock(hashtextextended('projects:' || account::text, 0));

    select plan, is_admin into account_plan, account_is_admin
    from public.profiles
    where id = account;

    if account_plan is distinct from 'pro' and not coalesce(account_is_admin, false) then
      if (select count(*) from public.projects where user_id = account) > 3 then
        raise exception 'Projekt-Limit des Plans erreicht (3)';
      end if;
    end if;
  end loop;

  return null;
end;
$$;

drop trigger if exists projects_plan_cap on public.projects;
create trigger projects_plan_cap after insert on public.projects
  referencing new table as new_rows
  for each statement execute function public.enforce_project_cap();

-- Läuft nur aus dem Trigger, muss nie per RPC aufrufbar sein (wie 0022).
revoke execute on function public.enforce_project_cap() from public, anon, authenticated;

-- ─── Obergrenzen je Konto ──────────────────────────────────────────────────
-- Argumente des Triggers: höchstens so viele Zeilen, optional die Spalte, deren Grösse zählt, und
-- höchstens so viele Bytes. Tabellen- und Spaltenname kommen nur aus den Trigger-Definitionen unten.
create or replace function public.enforce_account_ceiling()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  max_rows bigint := tg_argv[0]::bigint;
  size_column text := tg_argv[1];
  max_bytes bigint := tg_argv[2]::bigint;
  account uuid;
  used_rows bigint;
  used_bytes bigint;
begin
  for account in select distinct user_id from new_rows order by user_id loop
    perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || account::text, 0));

    execute format(
      'select count(*), coalesce(sum(pg_column_size(%s)), 0) from public.%I where user_id = $1',
      coalesce(quote_ident(size_column), 'null::int'),
      tg_table_name
    )
    into used_rows, used_bytes
    using account;

    if used_rows > max_rows then
      raise exception 'Obergrenze des Kontos erreicht: % (% Zeilen)', tg_table_name, max_rows;
    end if;

    if used_bytes > max_bytes then
      raise exception 'Obergrenze des Kontos erreicht: % (% Bytes)', tg_table_name, max_bytes;
    end if;
  end loop;

  return null;
end;
$$;

revoke execute on function public.enforce_account_ceiling() from public, anon, authenticated;

drop trigger if exists conversations_account_ceiling on public.conversations;
create trigger conversations_account_ceiling after insert on public.conversations
  referencing new table as new_rows
  for each statement execute function public.enforce_account_ceiling('10000');

drop trigger if exists messages_account_ceiling on public.messages;
create trigger messages_account_ceiling after insert on public.messages
  referencing new table as new_rows
  for each statement execute function public.enforce_account_ceiling('50000', 'content', '52428800');

drop trigger if exists saved_prompts_account_ceiling on public.saved_prompts;
create trigger saved_prompts_account_ceiling after insert on public.saved_prompts
  referencing new table as new_rows
  for each statement execute function public.enforce_account_ceiling('5000', 'outputs', '20971520');

drop trigger if exists project_files_account_ceiling on public.project_files;
create trigger project_files_account_ceiling after insert on public.project_files
  referencing new table as new_rows
  for each statement execute function public.enforce_account_ceiling('500');

-- ─── Budget im Speicher ────────────────────────────────────────────────────
-- Die Grenze sitzt am Bucket und nicht an project_files: ein hochgeladenes Objekt braucht keine Zeile,
-- und es überlebt das Löschen seines Projekts. Anlegen, 20 Objekte, löschen, von vorn liefe sonst an
-- jeder Grenze je Projekt vorbei. Gezählt wird alles im Ordner des Kontos.
--
-- Die Grösse steht erst nach dem Hochladen fest, deshalb prüft die Policy, was schon liegt: ein Upload
-- kann die Grenze um höchstens ein Objekt (2 MiB) überschreiten, parallele Uploads um je eines. Der
-- Rest der Policy ist unverändert, inklusive der Qualifizierung von objects.name (`name` allein bindet
-- in den Unterabfragen an projects.name).
drop policy if exists project_files_owner_insert on storage.objects;
create policy project_files_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'project-files'
    and (storage.foldername(objects.name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.projects p
      where p.id::text = (storage.foldername(objects.name))[2]
        and p.user_id = (select auth.uid())
    )
    and (
      select count(*)
      from storage.objects o
      where o.bucket_id = 'project-files'
        and o.name like (select auth.uid())::text || '/' || (storage.foldername(objects.name))[2] || '/%'
    ) < 20
    and (
      select count(*) < 500 and coalesce(sum((o.metadata->>'size')::bigint), 0) < 104857600
      from storage.objects o
      where o.bucket_id = 'project-files'
        and o.name like (select auth.uid())::text || '/%'
    )
  );

-- ─── Eigentümer der Elternzeile (#233) ─────────────────────────────────────
-- Fremdschlüssel prüfen ohne RLS: ohne diese Bedingungen zeigte eine eigene Zeile auf ein fremdes
-- Projekt oder einen fremden Chat, und das Löschen dort nähme sie mit. Dieselbe Prüfung wie
-- saved_prompts_owner_insert. Die Spalten sind qualifiziert, damit sie nicht an die Unterabfrage binden.
drop policy if exists conversations_owner on public.conversations;
create policy conversations_owner on public.conversations
  for all using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      conversations.project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = conversations.project_id and p.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists messages_owner_insert on public.messages;
create policy messages_owner_insert on public.messages
  for insert with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = (select auth.uid())
    )
  );

drop policy if exists project_files_owner on public.project_files;
create policy project_files_owner on public.project_files
  for all using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_files.project_id and p.user_id = (select auth.uid())
    )
  );
