-- PromptPrinter — aggregate project summaries for the Projekte/Bibliothek page
-- Run AFTER 0015_user_api_keys.sql.
--
-- projects/page.tsx used to pull every generation and every conversation row
-- the user has ever created, then reduce them to "latest generation per
-- project" and "chat count per project" in JS. That scales with total
-- historical usage, not with project count — the wrong axis for a page that
-- only ever needs one summary row per project. This function does the same
-- reduction in Postgres via a LATERAL join per project (index-only against
-- generations_project_created_idx / conversations_project_idx, 0009), so the
-- work is O(projects) instead of O(all-time generations + conversations).
--
-- security invoker (the default, made explicit) — this runs under the calling
-- user's own role, so the existing RLS policies on generations/conversations
-- apply exactly as if the client had queried them directly. The
-- `p.user_id = auth.uid()` filter is the same explicit defense-in-depth this
-- project already applies alongside RLS elsewhere, not a substitute for it.
-- chat_count is cast to int, not left as count(*)'s native bigint: PostgREST
-- serializes bigint/int8 as a JSON string (to avoid float precision loss),
-- which would silently turn `chatCount === 1` checks on the client into a
-- number-vs-string mismatch. int fits this count comfortably.
create or replace function public.project_summaries()
returns table (
  project_id uuid,
  latest_outputs jsonb,
  latest_generation_at timestamptz,
  chat_count int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id as project_id,
    g.outputs as latest_outputs,
    g.created_at as latest_generation_at,
    coalesce(c.chat_count, 0) as chat_count
  from public.projects p
  left join lateral (
    select outputs, created_at
    from public.generations
    where generations.project_id = p.id
    order by created_at desc
    limit 1
  ) g on true
  left join lateral (
    select count(*)::int as chat_count
    from public.conversations
    where conversations.project_id = p.id
  ) c on true
  where p.user_id = auth.uid();
$$;

grant execute on function public.project_summaries() to authenticated;
