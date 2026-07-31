-- PromptPrinter — evaluate auth.uid() once per query, not once per row
-- Run AFTER 0034_client_writable_size_limits.sql.
--
-- Supabase's own database linter (auth_rls_initplan) flagged all 13 RLS
-- policies in the public schema. A bare `auth.uid()` inside a policy is a
-- volatile-looking function call that Postgres re-evaluates FOR EVERY ROW it
-- checks; wrapping it as `(select auth.uid())` turns it into an InitPlan that
-- runs once and is reused for the whole scan.
--
-- This is purely a plan change. `(select auth.uid())` returns exactly what
-- `auth.uid()` returns, so every policy below grants and denies precisely what
-- it did before — the predicates are otherwise reproduced verbatim from
-- pg_policies. It matters most on the tables where a policy is checked against
-- many rows at once: messages (a chat's whole transcript), generations and
-- conversations (the list pages).
--
-- Two things deliberately preserved rather than "cleaned up" while rewriting:
--
--   * `messages` keeps only SELECT and INSERT policies. There is no UPDATE and
--     no DELETE policy, which is what makes a stored transcript append-only
--     from the client's side. Adding them here would be a silent change to a
--     security property, not a refactor.
--
--   * generations_owner_insert keeps its project-ownership EXISTS clause from
--     0031 — the check that stops a saved prompt being filed into someone
--     else's project. Both auth.uid() calls inside it are wrapped.
--
-- Every policy keeps its original role targeting (none of them named a role,
-- so they apply to public and are gated by the GRANTs from 0002/0028).

-- ── profiles ───────────────────────────────────────────────────────────────
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using ((select auth.uid()) = id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ── projects ───────────────────────────────────────────────────────────────
drop policy if exists projects_owner on public.projects;
create policy projects_owner on public.projects
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── conversations ──────────────────────────────────────────────────────────
drop policy if exists conversations_owner on public.conversations;
create policy conversations_owner on public.conversations
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── messages (append-only from the client: no update/delete policy) ────────
drop policy if exists messages_owner_select on public.messages;
create policy messages_owner_select on public.messages
  for select using ((select auth.uid()) = user_id);

drop policy if exists messages_owner_insert on public.messages;
create policy messages_owner_insert on public.messages
  for insert with check ((select auth.uid()) = user_id);

-- ── generations ────────────────────────────────────────────────────────────
drop policy if exists generations_owner_select on public.generations;
create policy generations_owner_select on public.generations
  for select using ((select auth.uid()) = user_id);

drop policy if exists generations_owner_insert on public.generations;
create policy generations_owner_insert on public.generations
  for insert with check (
    (select auth.uid()) = user_id
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = generations.project_id
          and p.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists generations_owner_update on public.generations;
create policy generations_owner_update on public.generations
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists generations_owner_delete on public.generations;
create policy generations_owner_delete on public.generations
  for delete using ((select auth.uid()) = user_id);

-- ── project_files ──────────────────────────────────────────────────────────
drop policy if exists project_files_owner on public.project_files;
create policy project_files_owner on public.project_files
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── user_api_keys ──────────────────────────────────────────────────────────
drop policy if exists user_api_keys_owner on public.user_api_keys;
create policy user_api_keys_owner on public.user_api_keys
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── subscriptions (read-only for the owner; writes are service-role only) ──
drop policy if exists subscriptions_owner_select on public.subscriptions;
create policy subscriptions_owner_select on public.subscriptions
  for select using ((select auth.uid()) = user_id);

-- ── project_files.user_id foreign key (linter: unindexed_foreign_keys) ─────
-- Deleting an account cascades through this FK, and /api/account's own cleanup
-- reads project_files by user_id directly. project_files_project_idx covers
-- (project_id, created_at) but nothing covered user_id on its own.
create index if not exists project_files_user_idx
  on public.project_files (user_id);
