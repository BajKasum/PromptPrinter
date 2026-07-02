-- PromptPrinter — Workspace v1 (REDESIGN.md, Phase 3)
-- Run AFTER 0010_conversation_project_link.sql.
--
-- Ein Projekt ist ab jetzt ein Container (Anweisungen + Struktur + n Chats +
-- Ergebnisse), kein eingefrorenes Generierungs-Ergebnis mehr. Dafür braucht es
-- zwei Dinge:
--   1. Ein lebendes Briefing: `instructions` (Freitext) und `context` (jsonb,
--      strukturierte Felder wie frontend/backend/language/database/target).
--   2. Leere Projekte müssen existieren dürfen: die alten Generierungs-Inputs
--      (audience, idea, tools) werden nullable. Bestandsdaten behalten ihre
--      Werte — nur der NOT-NULL-Zwang fällt.
--
-- Kein neuer Grant nötig: 0002 vergibt table-level select/insert/update/delete
-- auf projects an authenticated; die owner-RLS-Policy (FOR ALL) aus 0001 deckt
-- die neuen Spalten mit ab. `type`/`status` bleiben unverändert — `type` ist
-- nur noch ein internes Alt-Datum, kein Produktkonzept.

alter table public.projects
  add column if not exists instructions text,
  add column if not exists context jsonb not null default '{}'::jsonb;

alter table public.projects alter column audience drop not null;
alter table public.projects alter column idea drop not null;
alter table public.projects alter column tools drop not null;

-- Altprojekte in die lebende Struktur übernehmen: die vier eingefrorenen
-- Bridge-Tools werden zu Struktur-Feldern (master → target). jsonb_strip_nulls
-- lässt Felder weg, die das jeweilige Pack nie hatte (general kennt z. B. kein
-- frontend). Nur Zeilen ohne bestehende Struktur anfassen — re-run-safe.
update public.projects
set context = jsonb_strip_nulls(
  jsonb_build_object(
    'frontend', tools ->> 'frontend',
    'backend',  tools ->> 'backend',
    'database', tools ->> 'database',
    'target',   coalesce(tools ->> 'target', tools ->> 'master')
  )
)
where context = '{}'::jsonb
  and tools is not null;
