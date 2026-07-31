-- PromptPrinter — index the ORDER BY the list pages actually use
-- Run AFTER 0032_project_summaries_revoke_public.sql.
--
-- Every ordered read of `projects` and every ordered read of a project's
-- `conversations` sorts by updated_at desc. Neither table had an index that
-- could deliver that order, so Postgres read the matching rows and then sorted
-- them on every page view. Confirmed with EXPLAIN against this database before
-- writing this migration — both plans contained an explicit Sort node:
--
--   projects      where user_id = ? order by updated_at desc limit 101
--     -> Sort (Sort Key: updated_at DESC)
--          -> Index Scan using projects_user_created_idx
--
--   conversations where project_id = ? and user_id = ? order by updated_at desc
--     -> Sort (Sort Key: updated_at DESC)
--          -> BitmapAnd (conversations_project_idx + conversations_user_updated_idx)
--
-- The sort is bounded now that those reads are capped at LIST_LOAD_LIMIT
-- (src/lib/chat-limits.ts), so this is not a correctness or blow-up risk — it
-- is work done per request that an index makes unnecessary. Callers affected:
-- /projects, the sidebar's pinned+recent projects, the ⌘K palette, the
-- move-to-project picker, and a project workspace's own chat list.
--
-- conversations(user_id, updated_at desc) already exists (0009) and covers the
-- global /chats list, so only the project-scoped ordering is added here.

create index if not exists projects_user_updated_idx
  on public.projects (user_id, updated_at desc);

create index if not exists conversations_project_updated_idx
  on public.conversations (project_id, updated_at desc);

-- Both replaced indexes are now fully redundant: each new index above shares
-- its leading column, so every lookup the old one served is served by the new
-- one too. Dropping them keeps write amplification (every insert/update
-- maintains every index on the table) and storage from growing for no read
-- benefit.
--
-- projects_user_created_idx (0001) — (user_id, created_at desc). Nothing
-- orders projects by created_at; verified by grepping every .from("projects")
-- call site. Its only remaining job was the user_id equality lookup that
-- projects_user_updated_idx now answers.
--
-- conversations_project_idx (0010) — (project_id). Its callers are the
-- project_summaries() lateral count and the workspace layout's chat count,
-- both plain project_id equality, which the new composite serves on its
-- leading column.
--
-- projects_user_favorite_idx (0004, partial `where is_favorite`) is
-- deliberately KEPT: the sidebar orders by is_favorite desc first, and a
-- partial index over just the pinned rows is a different, still-useful shape.

drop index if exists public.projects_user_created_idx;
drop index if exists public.conversations_project_idx;
