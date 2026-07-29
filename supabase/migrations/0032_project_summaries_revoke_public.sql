-- PromptPrinter — revoke project_summaries() from PUBLIC (Security-Audit
-- finding L-2)
-- Run AFTER 0031_generations_project_ownership_check.sql.
--
-- has_function_privilege('anon', 'project_summaries()', 'EXECUTE') returned
-- true, but no migration ever granted it to anon directly — 0016 and 0023
-- both only ever wrote `grant execute ... to authenticated`. The source is
-- Postgres's own default: CREATE FUNCTION grants EXECUTE to PUBLIC unless the
-- migration revokes it first, and every role (anon included) is implicitly a
-- member of PUBLIC for privilege purposes. Same root cause 0003/0022 already
-- revoked for their own trigger-only functions, just never applied here.
--
-- Harmless in practice, verified before writing this: the function is
-- `security invoker` and filters `where p.user_id = auth.uid()`, which is
-- NULL for an anonymous caller, so it already returns zero rows — this closes
-- an unnecessary grant, not a live leak.
revoke execute on function public.project_summaries() from public;

-- Re-assert explicitly rather than relying on the grant 0023 already made, so
-- this migration is a complete, correct statement of the intended privilege on
-- its own — the same pattern 0020/0022 used for their own revoke-then-regrant.
grant execute on function public.project_summaries() to authenticated;
