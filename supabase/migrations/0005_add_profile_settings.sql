-- PromptPrinter — per-user settings blob on profiles
-- Run AFTER 0004_add_project_favorites.sql.
--
-- Holds user-level preferences (first use: project defaults for the /new wizard).
-- A jsonb column on the existing single-owner profiles row keeps this in the row
-- we already fetch — no new table, no new RLS policy. The profiles_self_update
-- policy and the table-level SELECT/UPDATE grant from 0002 already cover it.

alter table public.profiles
  add column if not exists settings jsonb not null default '{}'::jsonb;
