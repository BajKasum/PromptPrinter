-- PromptPrinter — Datenmodell der gespeicherten Prompts (#140)
-- Run AFTER 0048_drop_avatar_upload_remnants.sql.
--
-- Die Tabelle `generations` stammt aus der Generierungs-Pipeline, die seit Juli 2026
-- entfernt ist. Sie hält heute nur noch gespeicherte Prompts (eine Zeile je Klick auf
-- "Prompt speichern", `outputs = { prompt, title }`). Der Name sagt etwas anderes als der
-- Inhalt. Dazu bleiben vier Spalten (model, latency_ms, tokens_in, tokens_out), die Spalte
-- `projects.status` und der Plan `team` von der alten Pipeline übrig.
--
-- In Produktion vorher gelesen (2026-10-25): `generations` 3 Zeilen; `model`, `latency_ms`,
-- `tokens_in`, `tokens_out` überall NULL und im Code nirgends gelesen; `projects.status` in
-- beiden Zeilen 'ready' und nirgends gelesen; `profiles.plan` nur 'free' (6 Konten), kein
-- 'team'. Auf der Tabelle hängen keine Sicht, kein Trigger und keine fremde Policy; die
-- einzige Funktion, die sie nennt, ist project_summaries() (unten neu angelegt).
--
-- Rückgängig: `alter table public.saved_prompts rename to generations` stellt den Namen
-- wieder her (Policies, Indizes, Fremdschlüssel hießen vorher `generations_…`); die
-- gelöschten Spalten waren leer; `projects.status` ist mit
-- `add column status text not null default 'ready'` wieder da.
--
-- Wiederholbar: jeder Schritt prüft, ob er schon gelaufen ist.

-- 1. Tabelle umbenennen. Policies, Indizes, Fremdschlüssel und Spaltenrechte folgen ihr,
--    ihre Namen ziehen die Schleifen nach (`generations_…` wird `saved_prompts_…`).
do $$
declare
  r record;
begin
  if to_regclass('public.generations') is not null then
    alter table public.generations rename to saved_prompts;
  end if;

  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'saved_prompts' and policyname like 'generations\_%'
  loop
    execute format(
      'alter policy %I on public.saved_prompts rename to %I',
      r.policyname, replace(r.policyname, 'generations_', 'saved_prompts_')
    );
  end loop;

  -- Der Primärschlüssel zieht seinen Index mit.
  for r in
    select conname from pg_constraint
    where conrelid = 'public.saved_prompts'::regclass and conname like 'generations\_%'
  loop
    execute format(
      'alter table public.saved_prompts rename constraint %I to %I',
      r.conname, replace(r.conname, 'generations_', 'saved_prompts_')
    );
  end loop;

  for r in
    select indexname from pg_indexes
    where schemaname = 'public' and tablename = 'saved_prompts' and indexname like 'generations\_%'
  loop
    execute format(
      'alter index public.%I rename to %I',
      r.indexname, replace(r.indexname, 'generations_', 'saved_prompts_')
    );
  end loop;
end
$$;

-- 2. Spalten der alten Pipeline (alle leer, siehe oben). Ihre Spaltenrechte gehen mit.
alter table public.saved_prompts
  drop column if exists model,
  drop column if exists latency_ms,
  drop column if exists tokens_in,
  drop column if exists tokens_out;

-- 3. `projects.status` kannte draft/generating/ready/error der Pipeline und steht fest auf
--    'ready'.
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects drop column if exists status;

-- 4. Den Plan `team` hat es nie zu kaufen gegeben.
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check check (plan in ('free', 'pro'));

-- 5. project_summaries() zählte aus `generations`. Ein SQL-Funktionskörper wird erst beim
--    Aufruf aufgelöst, nach dem Umbenennen wäre sie also kaputt. Die Spalten bleiben wie in
--    0023, deshalb genügt `create or replace`.
create or replace function public.project_summaries()
returns table (
  project_id uuid,
  chat_count int,
  saved_count int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id as project_id,
    coalesce(c.chat_count, 0) as chat_count,
    coalesce(s.saved_count, 0) as saved_count
  from public.projects p
  left join lateral (
    select count(*)::int as chat_count
    from public.conversations
    where conversations.project_id = p.id
  ) c on true
  left join lateral (
    select count(*)::int as saved_count
    from public.saved_prompts
    where saved_prompts.project_id = p.id
  ) s on true
  where p.user_id = auth.uid();
$$;

-- Wie 0032: PUBLIC (und damit anon) bekommt EXECUTE nicht, authenticated schon.
revoke execute on function public.project_summaries() from public;
grant execute on function public.project_summaries() to authenticated;
