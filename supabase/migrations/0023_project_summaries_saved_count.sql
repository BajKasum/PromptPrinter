-- PromptPrinter — project_summaries(): add saved_count, drop unused columns
-- (QA finding P-2, also closes I-2)
-- Run AFTER 0022_project_file_limits.sql.
--
-- 0016 built this function specifically to replace an O(all-time
-- generations + conversations) JS reduction with an O(projects) query — and
-- projects/page.tsx still runs exactly that pattern for the saved-prompt
-- count, right next to the call that uses this function for chat_count:
-- a plain `select project_id from generations where user_id = ?` loading
-- every saved prompt the user has ever made, reduced into a per-project map
-- client-side. The thing 0016 was built to eliminate, reintroduced one
-- column over. Folded in here as a third LATERAL join, same shape as the
-- existing chat_count one.
--
-- Also drops latest_outputs/latest_generation_at: unused since the
-- Ergebnisse-Neubau (2026-07) moved projects off the old artifact-packet
-- display (verified: no caller reads either field, only chat_count).
-- Kept until now only to avoid a DB round-trip just to drop a column —
-- the function is already being replaced for saved_count, so there's no
-- extra round-trip left to save by keeping them.
--
-- CREATE OR REPLACE cannot change a function's returns-table column set, so
-- this drops and recreates rather than replacing in place.
drop function if exists public.project_summaries();

create function public.project_summaries()
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
    from public.generations
    where generations.project_id = p.id
  ) s on true
  where p.user_id = auth.uid();
$$;

grant execute on function public.project_summaries() to authenticated;
