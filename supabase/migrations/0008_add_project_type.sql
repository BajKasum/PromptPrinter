-- PromptPrinter — add a prompt-type discriminator to projects
-- The product started as a software-build generator (every project produced the
-- same 10 build artifacts). This column lets a project belong to a different
-- "pack" — starting with 'general', a freeform prompt + variants for any goal
-- (study material, writing, planning…), not just software.
--
-- Default 'software' so every existing row and the unchanged software flow keep
-- working without a backfill. The check constraint is added separately and
-- guarded so re-running the migration is safe.

alter table public.projects
  add column if not exists type text not null default 'software';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_type_check') then
    alter table public.projects
      add constraint projects_type_check check (type in ('software', 'general'));
  end if;
end $$;
