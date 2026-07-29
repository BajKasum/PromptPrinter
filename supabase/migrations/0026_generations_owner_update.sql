-- PromptPrinter — allow owners to rename their own saved prompts (QA finding
-- N-1, the naming half of the rework — see 0025's comment for the rest)
-- Run AFTER 0025_generations_project_id_nullable.sql.
--
-- 0001 created public.generations as an append-only generation log (SELECT +
-- INSERT only). 0018 added DELETE for the Ergebnisse-Neubau. Naming a saved
-- prompt ("sessionStartPrompt") needs UPDATE too, which nothing granted yet —
-- `authenticated` had no UPDATE privilege on this table at all (verified
-- live via information_schema.role_table_grants).
--
-- Explicit column allowlist (`outputs` only), not a blanket grant — same
-- lesson 0014 wrote down for profiles and 0020 applied to user_api_keys:
-- the rename UI only ever needs to rewrite outputs (it reconstructs the
-- whole { prompt, title, target } object client-side, since that's one
-- JSONB column), never user_id/project_id/model/tokens_in/tokens_out/
-- latency_ms — none of those should be client-writable after the row is
-- created.
drop policy if exists generations_owner_update on public.generations;
create policy generations_owner_update on public.generations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant update (outputs) on public.generations to authenticated;
