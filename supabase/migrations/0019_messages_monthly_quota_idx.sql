-- PromptPrinter — index the monthly chat-quota count (QA finding P-8)
-- Run AFTER 0018_generations_owner_delete.sql.
--
-- /api/chat's monthly-allowance fallback (used whenever Redis isn't the
-- authority for a given request) counts a user's assistant replies since the
-- start of the current month on every single chat turn:
--   select count(*) from messages where user_id = ? and role = 'assistant'
--     and created_at >= <month start>
-- The only existing index on this table is messages_conversation_created_idx
-- (conversation_id, created_at), which doesn't cover a filter keyed on
-- user_id — this query fell back to a sequential scan, growing with the
-- user's entire lifetime message history rather than with the current month.
--
-- Partial + covering: `where role = 'assistant'` matches the query's own
-- filter exactly, so the index only ever needs to hold half the table's rows,
-- and putting created_at second lets the range filter use the index directly
-- instead of a bitmap-then-filter step.

create index if not exists messages_user_assistant_created_idx
  on public.messages (user_id, created_at)
  where role = 'assistant';
