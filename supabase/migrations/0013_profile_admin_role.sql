-- PromptPrinter — admin role flag on profiles
-- Run AFTER 0012_project_files.sql.
--
-- A role, not a plan: `plan` stays exactly what it is today (the billing
-- tier — free/pro/team); `is_admin` is an orthogonal flag that exempts an
-- account from plan limits and shows "Admin" in the UI instead of a tier
-- badge. Deliberately not folded into `plan` — mixing "which tier do you pay
-- for" with "are you exempt from tiers" in one column would make the two
-- concerns impossible to reason about separately later.
--
-- Locking down who can set it is handled in 0014, not here: a column-level
-- REVOKE against a pre-existing TABLE-level grant is a no-op in Postgres
-- (verified live) — see 0014_profile_column_grants.sql for the actual fix.
alter table public.profiles
  add column if not exists is_admin boolean not null default false;
