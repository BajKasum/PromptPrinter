-- PromptPrinter — Versionen gespeicherter Prompts
-- Run AFTER 0060_byok_writes_server_only.sql. Kein laufender Code liest die neuen Spalten oder die neue Tabelle;
-- der Code, der sie nutzt, kommt erst, wenn diese Migration auf Produktion liegt.
--
-- AKTUELLE FASSUNG UND VERLAUF: saved_prompts.outputs bleibt die aktuelle Fassung. Alles, was einen gespeicherten
-- Prompt liest (Liste, Teilen, Export für Entwickler, api/cli/prompts für CLI und MCP), läuft unverändert. Der Verlauf
-- steht in saved_prompt_versions, je Version ein vollständiger Schnappschuss des Texts (outputs->>'prompt'), kein Diff.
--
-- WER SCHREIBT: nur die Datenbank. Ein Trigger hängt nach jedem Einfügen eines Prompts und nach jeder Änderung seines
-- Texts eine Version an; Umbenennen (nur outputs.title) und ein Update mit demselben Text legen keine an. So gibt es
-- keinen Weg, den Text ohne Version zu ändern, und niemand fälscht eine Version: authenticated und service_role dürfen
-- die Tabelle nur lesen, schreiben kann nur der Trigger (security definer, Eigentümer der Tabelle). Wiederherstellen
-- schreibt den alten Text als aktuelle Fassung zurück, der Trigger legt ihn als neueste Version an. Eine Version
-- verschwindet nur mit ihrem Prompt oder dem Konto (Fremdschlüssel).
--
-- NUMMER: höchste Nummer des Prompts plus eins. Ein Update sperrt die Zeile in saved_prompts bis zum Commit; ein
-- zweites Update desselben Prompts wartet und zählt danach mit frischem Snapshot. unique (prompt_id, version) fängt
-- den Rest ab.
--
-- GRENZE JE KONTO: 20 000 Versionen und 40 MiB, gezählt von enforce_account_ceiling aus 0051 (Zeilen und
-- pg_column_size). Keine Grenze je Prompt, gelöscht wird nichts. Reisst eine Änderung die Grenze, scheitert die ganze
-- Änderung des Prompts (P0001), der Text bleibt beim alten. Dieselben Zahlen in ACCOUNT_CEILINGS
-- (src/shared/lib/plans.ts), tests/guards/account-ceilings.test.ts hält beide gleich.
--
-- CHAT AM PROMPT, URSPRUNG AM CHAT: saved_prompts.conversation_id ist der Chat, aus dem gespeichert wurde;
-- conversations.source_prompt_id der Prompt, aus dem ein Chat mit "Als Ausgangspunkt nutzen" entstand. Daran erkennt
-- Speichern, dass es eine neue Version sein kann. Beide Spalten prüfen in der Policy den Eigentümer der Elternzeile
-- wie 0051: ein Fremdschlüssel prüft ohne RLS, sonst zeigte eine eigene Zeile auf einen fremden Chat oder Prompt.
-- Die Update-Policy von saved_prompts prüft mit, weil der lokale Stack authenticated die ganze Tabelle ändern lässt
-- (Standardrechte von Supabase), nicht nur outputs wie das Spaltenrecht aus 0026.
--
-- LÖSCHEN: ein gelöschter Chat leert saved_prompts.conversation_id, ein gelöschter Prompt conversations.source_prompt_id
-- (on delete set null). Das Leeren durch die Datenbank ist keine Aktivität im Chat: conversations_updated_at setzt
-- updated_at dann nicht neu, sonst sprängen alle Chats eines gelöschten Prompts an den Anfang der Liste.
--
-- BESTAND: jeder vorhandene Prompt bekommt Version 1 mit seinem heutigen Text und seinem created_at, sonst hätte ein
-- alter Prompt keinen Anfang im Verlauf.
--
-- Rückgängig (die Policies stehen danach wie in 0035, 0049 und 0051):
--   drop trigger if exists saved_prompts_version_log_insert on public.saved_prompts;
--   drop trigger if exists saved_prompts_version_log_update on public.saved_prompts;
--   drop function if exists public.log_saved_prompt_versions();
--   drop table if exists public.saved_prompt_versions;
--   alter table public.conversations drop column if exists source_prompt_id;
--   alter table public.saved_prompts drop column if exists conversation_id;
--   conversations_updated_at ohne when-Bedingung neu anlegen (0009).
--
-- Wiederholbar: Spalten, Tabelle und Indizes mit if not exists, Policies und Trigger werden vorher entfernt, der
-- Bestand nur für Prompts ohne Version eingefügt.

-- ─── Chat am Prompt, Ursprung am Chat ──────────────────────────────────────
alter table public.saved_prompts
  add column if not exists conversation_id uuid references public.conversations (id) on delete set null;

alter table public.conversations
  add column if not exists source_prompt_id uuid references public.saved_prompts (id) on delete set null;

-- Für das Leeren beim Löschen und für die Suche nach dem zuletzt im Chat gespeicherten Prompt. Die meisten Zeilen
-- haben keinen Wert, deshalb nur die mit.
create index if not exists saved_prompts_conversation_idx
  on public.saved_prompts (conversation_id) where conversation_id is not null;

create index if not exists conversations_source_prompt_idx
  on public.conversations (source_prompt_id) where source_prompt_id is not null;

-- ─── Eigentümer der Elternzeile ────────────────────────────────────────────
-- Projekt-Prüfung wie 0035, Chat-Prüfung neu. Die Spalten sind qualifiziert, damit sie nicht an die Unterabfrage binden.
drop policy if exists saved_prompts_owner_insert on public.saved_prompts;
create policy saved_prompts_owner_insert on public.saved_prompts
  for insert with check (
    (select auth.uid()) = user_id
    and (
      saved_prompts.project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = saved_prompts.project_id and p.user_id = (select auth.uid())
      )
    )
    and (
      saved_prompts.conversation_id is null
      or exists (
        select 1 from public.conversations c
        where c.id = saved_prompts.conversation_id and c.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists saved_prompts_owner_update on public.saved_prompts;
create policy saved_prompts_owner_update on public.saved_prompts
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      saved_prompts.conversation_id is null
      or exists (
        select 1 from public.conversations c
        where c.id = saved_prompts.conversation_id and c.user_id = (select auth.uid())
      )
    )
  );

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
    and (
      conversations.source_prompt_id is null
      or exists (
        select 1 from public.saved_prompts sp
        where sp.id = conversations.source_prompt_id and sp.user_id = (select auth.uid())
      )
    )
  );

-- ─── updated_at nur bei Aktivität im Chat ──────────────────────────────────
drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at before update on public.conversations
  for each row
  when (old.source_prompt_id is not distinct from new.source_prompt_id)
  execute function public.set_updated_at();

-- ─── Verlauf ───────────────────────────────────────────────────────────────
-- Grösse wie outputs (0021). Der zusammengesetzte Fremdschlüssel (Ziel saved_prompts_id_user_key aus 0057) hält fest,
-- dass eine Version demselben Konto gehört wie ihr Prompt.
create table if not exists public.saved_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  version int not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint saved_prompt_versions_version_positive check (version >= 1),
  constraint saved_prompt_versions_content_len check (pg_column_size(content) <= 200000),
  constraint saved_prompt_versions_prompt_version_key unique (prompt_id, version),
  constraint saved_prompt_versions_prompt_owner_fkey foreign key (prompt_id, user_id)
    references public.saved_prompts (id, user_id) on delete cascade
);

-- Für die Grenze je Konto und den Export des Kontos. Die Versionen eines Prompts findet der eindeutige Index oben.
create index if not exists saved_prompt_versions_user_idx on public.saved_prompt_versions (user_id);

alter table public.saved_prompt_versions enable row level security;

drop policy if exists saved_prompt_versions_owner_select on public.saved_prompt_versions;
create policy saved_prompt_versions_owner_select on public.saved_prompt_versions
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Nur lesen, für alle Rollen ausser dem Eigentümer: anon nichts, authenticated die eigenen Zeilen (Policy oben),
-- service_role alles zum Lesen (Export des Kontos). Kein insert, update oder delete, auch nicht für den Server.
revoke all on public.saved_prompt_versions from anon, authenticated, service_role;
grant select on public.saved_prompt_versions to authenticated, service_role;

-- ─── Versionen anlegen ─────────────────────────────────────────────────────
-- Ein Trigger je Befehl: ein Befehl mit vielen Zeilen schreibt seine Versionen in einem Einfügen, die Grenze zählt
-- einmal. security definer, weil sonst niemand schreiben dürfte; search_path leer wie jede Funktion seit 0003.
--
-- EXECUTE statt einer festen Abfrage: plpgsql behält den Plan einer festen Abfrage je Verbindung, geplant beim ersten
-- Aufruf. Hatten die Transition-Tabellen dort eine Zeile, verbindet der behaltene Plan später 5 000 geänderte Zeilen
-- Zeile für Zeile, und die Suche nach der höchsten Nummer läuft über die ganze Tabelle, solange sie beim Planen klein
-- war (gemessen: ein Update über 5 000 Prompts nach einem Update über einen 2,5 s statt 0,35 s). EXECUTE plant jedes
-- Mal mit den echten Zahlen.
create or replace function public.log_saved_prompt_versions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    execute $sql$
      insert into public.saved_prompt_versions (prompt_id, user_id, version, content)
      select
        n.id,
        n.user_id,
        coalesce((select max(v.version) from public.saved_prompt_versions v where v.prompt_id = n.id), 0) + 1,
        coalesce(n.outputs->>'prompt', '')
      from new_rows n
    $sql$;
  else
    execute $sql$
      insert into public.saved_prompt_versions (prompt_id, user_id, version, content)
      select
        n.id,
        n.user_id,
        coalesce((select max(v.version) from public.saved_prompt_versions v where v.prompt_id = n.id), 0) + 1,
        coalesce(n.outputs->>'prompt', '')
      from new_rows n
      join old_rows o on o.id = n.id
      where n.outputs->>'prompt' is distinct from o.outputs->>'prompt'
    $sql$;
  end if;

  return null;
end;
$$;

-- Läuft nur aus den Triggern, muss nie per RPC aufrufbar sein (wie 0051).
revoke execute on function public.log_saved_prompt_versions() from public, anon, authenticated;

-- Transition-Tabellen vertragen nur ein Ereignis je Trigger und keine Spaltenliste, deshalb zwei Trigger, und der
-- für das Update sucht die geänderten Texte selbst. Der Name sortiert nach saved_prompts_account_ceiling*: Postgres
-- ruft Trigger derselben Art alphabetisch, die Grenze der Prompts prüft also vor dem Verlauf.
drop trigger if exists saved_prompts_version_log_insert on public.saved_prompts;
create trigger saved_prompts_version_log_insert after insert on public.saved_prompts
  referencing new table as new_rows
  for each statement execute function public.log_saved_prompt_versions();

drop trigger if exists saved_prompts_version_log_update on public.saved_prompts;
create trigger saved_prompts_version_log_update after update on public.saved_prompts
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.log_saved_prompt_versions();

-- ─── Bestand ───────────────────────────────────────────────────────────────
-- Nach den Triggern: ein Prompt, der währenddessen entsteht, hat seine Version schon und wird übersprungen. Vor der
-- Grenze: bestehende Konten verlieren nichts (wie 0051).
insert into public.saved_prompt_versions (prompt_id, user_id, version, content, created_at)
select p.id, p.user_id, 1, coalesce(p.outputs->>'prompt', ''), p.created_at
from public.saved_prompts p
where not exists (select 1 from public.saved_prompt_versions v where v.prompt_id = p.id);

-- ─── Grenze je Konto ───────────────────────────────────────────────────────
drop trigger if exists saved_prompt_versions_account_ceiling on public.saved_prompt_versions;
create trigger saved_prompt_versions_account_ceiling after insert on public.saved_prompt_versions
  referencing new table as new_rows
  for each statement execute function public.enforce_account_ceiling('20000', 'content', '41943040');
