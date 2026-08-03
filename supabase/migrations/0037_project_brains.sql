-- PromptPrinter — Project Brain (das Projekt-Gedächtnis)
-- Run AFTER 0036_storage_rls_initplan.sql.
--
-- Eine Zeile pro Projekt: was die Analyse aus dessen Dateien und/oder GitHub-
-- Repo über den Stack herausgefunden hat (Framework, Sprache, Architektur,
-- Datenbank, Design-System, Coding-Style, Konventionen). buildProjectContext
-- injiziert das ab dann in JEDEN Chat des Projekts, damit der Nutzer seinen
-- Stack nicht in jedem Prompt neu erklärt.
--
-- WARUM EINE EIGENE TABELLE UND NICHT projects.context:
-- `projects.context` sind die Angaben, die der NUTZER selbst in die Rail
-- getippt hat. Das hier ist maschinell abgeleitet. In einer Spalte gemischt
-- liesse sich hinterher nicht mehr unterscheiden, was der Nutzer gesagt und
-- was ein Modell vermutet hat — und die Reihenfolge im Prompt hängt genau an
-- dieser Unterscheidung (Nutzerangaben schlagen Ableitungen, siehe
-- project-context.ts). Dazu hat das Brain einen Lebenszyklus (Status, Fehler,
-- Veraltung), den ein jsonb-Feld auf projects nicht sauber trägt.
--
-- 1:1 zum Projekt, deshalb ist project_id direkt der Primärschlüssel: ein
-- Projekt hat genau ein Gedächtnis, und ein Upsert braucht keinen
-- zusätzlichen Unique-Index, um das durchzusetzen.

create table if not exists public.project_brains (
  project_id uuid primary key references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'idle'
    check (status in ('idle', 'analyzing', 'ready', 'failed')),
  -- Die geparsten Fakten (projectBrainFactsSchema in
  -- src/shared/lib/project-brain.ts). Grössenschranke in derselben Form wie
  -- 0021 sie für messages.content/generations.outputs gesetzt hat: die Route
  -- validiert bereits gegen das Zod-Schema, das hier ist die Schranke für den
  -- Tag, an dem jemand anders schreibt.
  facts jsonb not null default '{}'::jsonb
    check (pg_column_size(facts) <= 16384),
  -- Die analysierte Repo-URL, kanonisch als https://github.com/owner/repo
  -- (parseGithubRepoUrl baut sie neu zusammen, sie wird nie roh übernommen).
  repo_url text check (repo_url is null or repo_url ~ '^https://github\.com/[^/]+/[^/]+$'),
  -- Commit-SHA des analysierten Standes, damit ein späterer Lauf sagen kann,
  -- ob sich am Repo überhaupt etwas geändert hat.
  repo_ref text check (repo_ref is null or length(repo_ref) <= 64),
  -- Welche Quellen in den Lauf eingegangen sind ([{kind, name, ...}]).
  sources jsonb not null default '[]'::jsonb
    check (pg_column_size(sources) <= 8192),
  -- Fingerabdruck derselben Quellen (sourceDigest()), Grundlage für
  -- „Quellen haben sich geändert, neu analysieren".
  source_digest text check (source_digest is null or length(source_digest) <= 64),
  model text check (model is null or length(model) <= 120),
  -- Stabiler Fehlercode, nie roher Provider-Text (Security-Audit M-1): der
  -- Client übersetzt ihn selbst, die Ursache steht im Log.
  error_code text check (error_code is null or length(error_code) <= 64),
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Die Kontext-Rail liest das Brain pro Projekt (Primärschlüssel deckt das),
-- der Kontostand-/Aufräumpfad liest es pro Nutzer.
create index if not exists project_brains_user_idx
  on public.project_brains(user_id);

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.project_brains enable row level security;

-- `(select auth.uid())` statt `auth.uid()`: seit 0035 der Hausstandard, der
-- Planer wertet den Aufruf damit einmal pro Query statt einmal pro Zeile aus.
drop policy if exists project_brains_owner on public.project_brains;
create policy project_brains_owner on public.project_brains
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ─── Privilege grants ──────────────────────────────────────────────────────
-- Bewusst NUR select. Geschrieben wird ausschliesslich in /api/projects/[id]/
-- brain, und zwar über den Service-Role-Client, nachdem die Route die
-- Eigentümerschaft selbst geprüft hat. Ein insert/update-Grant für
-- `authenticated` würde bedeuten, dass ein Nutzer sich sein eigenes
-- „analysiertes" Brain aus der Browser-Konsole schreiben kann — nicht
-- gefährlich für andere, aber es macht den einen Wert unglaubwürdig, den
-- diese Tabelle verspricht: dass die Fakten aus den echten Quellen stammen
-- und nicht aus einer Behauptung. Dieselbe Linie wie 0028: nur die
-- DML-Rechte vergeben, die tatsächlich vom Client ausgehen.
grant select on public.project_brains to authenticated;

-- ─── updated_at ────────────────────────────────────────────────────────────
-- Trägt die Antwort auf „läuft die Analyse noch, oder ist der Status nur
-- hängengeblieben?" (isAnalysisRunning, src/shared/lib/project-brain.ts). Die
-- Route setzt updated_at bei jedem Schreibvorgang selbst mit; der Trigger ist
-- die Absicherung dagegen, dass ein späterer Schreibpfad das vergisst und der
-- Spinner dadurch ewig stehen bleibt.
create or replace function public.touch_project_brain()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_brains_touch on public.project_brains;
create trigger project_brains_touch before update on public.project_brains
  for each row execute function public.touch_project_brain();

revoke execute on function public.touch_project_brain() from public, anon, authenticated;
