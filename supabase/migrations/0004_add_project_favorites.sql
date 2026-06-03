-- PromptPrinter — per-project favorite flag for the Bibliothek
-- Run AFTER 0003_harden_functions.sql.
--
-- Favorites are per-user, and every project has exactly one owner, so a single
-- boolean on `projects` is sufficient (no join table needed). The existing
-- `projects_owner` RLS policy (FOR ALL) already lets a user toggle this on their
-- own rows, and the table-level UPDATE grant from 0002 covers the new column.

alter table public.projects
  add column if not exists is_favorite boolean not null default false;

-- Speeds up "show only my favorites" lookups; partial so it stays tiny.
create index if not exists projects_user_favorite_idx
  on public.projects(user_id)
  where is_favorite;
