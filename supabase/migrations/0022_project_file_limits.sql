-- PromptPrinter — enforce the file-per-project limit and extension allowlist
-- server-side (QA finding F-6)
-- Run AFTER 0021_content_size_limits.sql.
--
-- MAX_FILES_PER_PROJECT (10) and the .md/.txt/.json/.csv allowlist
-- (project-files.ts) were only ever checked in project-files.tsx before this.
-- Upload and insert run directly against Supabase from the browser client, so
-- neither limit was actually enforced: a user could insert as many
-- project_files rows, of any extension, as they wanted. 0012 documents this
-- itself ("enforced client-side"). Two open tabs also raced past the client
-- check independently (both read "9 of 10" and both upload, ending at 11) —
-- this trigger closes that too, since count(*) runs inside the same
-- transaction as the insert it's guarding.
--
-- security invoker (the default, made explicit, matching 0016's own
-- convention): runs as the calling (authenticated) role, so RLS still scopes
-- the count() to rows that role can see — which for project_files is already
-- every row (0012's policy has no extra restriction beyond ownership through
-- the FK), so this is equivalent to an unscoped count in practice, just
-- without a service-role bypass nobody needs here.
create or replace function public.enforce_project_file_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select count(*) from public.project_files where project_id = new.project_id) >= 10 then
    raise exception 'Projekt-Dateilimit erreicht (10)';
  end if;
  if lower(new.name) !~ '\.(md|txt|json|csv)$' then
    raise exception 'Dateityp nicht erlaubt';
  end if;
  return new;
end;
$$;

drop trigger if exists project_files_limit on public.project_files;
create trigger project_files_limit before insert on public.project_files
  for each row execute function public.enforce_project_file_limit();

-- Runs only from the trigger above, never needs to be RPC-callable (same
-- reasoning as 0003's own trigger functions).
revoke execute on function public.enforce_project_file_limit() from public, anon, authenticated;
