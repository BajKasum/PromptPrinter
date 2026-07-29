-- PromptPrinter — verify project_id ownership on generations insert
-- (Security-Audit finding L-1)
-- Run AFTER 0030_byok_active_provider.sql.
--
-- save-prompt-button.tsx writes directly through the RLS-scoped browser client
-- (no API route between the click and the insert — see that file's own
-- comment for why). 0001's INSERT policy only ever checked
-- `auth.uid() = user_id`, never that a non-null project_id actually belongs to
-- that user. `projectId` is a prop threaded down from the page/route params,
-- so nothing in the ordinary UI can pass a foreign one — but the write itself
-- runs client-side, so a modified client (devtools, a direct REST call) could
-- insert a saved prompt under any project_id it likes.
--
-- Impact was always bounded, not a cross-user read: project_summaries() and
-- every workspace query are themselves RLS-scoped to `p.user_id = auth.uid()`,
-- so a foreign project_id never surfaces in the actual owner's counts or
-- results list — the row is invisible to everyone but its own user_id, who
-- can only find it via /prompts (project-independent). The real defect is
-- integrity: deleting that foreign project would cascade-delete a saved
-- prompt that was never really "in" it, and it's exactly the same class of bug
-- F-8 already fixed for conversations.project_id, left open here because this
-- path never goes through a server route where that fix could apply.
--
-- Same fix as F-8's principle, applied where this write actually happens: the
-- RLS policy itself. NULL stays allowed (a global chat's saved prompt has no
-- project), and a non-null value must resolve to a project this user owns.
drop policy if exists generations_owner_insert on public.generations;
create policy generations_owner_insert on public.generations
  for insert with check (
    auth.uid() = user_id
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = project_id and p.user_id = auth.uid()
      )
    )
  );

-- Verified against the live database before committing, as `authenticated`
-- with a real user's JWT claims, in a transaction that was rolled back:
--   1. insert with a project_id that doesn't resolve to an owned project
--      (covers both "someone else's project" and "made up id" identically,
--      the EXISTS clause can't tell them apart, which is exactly the point)
--                                          -> REJECTED
--   2. insert with project_id = null (global chat save) -> ACCEPTED
--   3. insert with the caller's own real project_id      -> ACCEPTED

