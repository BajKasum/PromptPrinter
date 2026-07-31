-- PromptPrinter — why the 0035 InitPlan fix must NOT be applied to storage
-- Run AFTER 0035_rls_initplan_auth_uid.sql.
--
-- ⚠️ NEGATIVE RESULT. This migration restates the seven storage.objects
-- policies in their CORRECT form — with a bare `auth.uid()` — and exists mainly
-- so the next person (or the next audit) does not repeat the change it
-- documents. It is idempotent and safe to re-run.
--
-- 0035 replaced `auth.uid()` with `(select auth.uid())` across the public
-- schema so Postgres evaluates it once per query instead of once per row.
-- Supabase's linter does not cover the `storage` schema, so these seven
-- policies were never flagged — and applying the same rewrite here looks
-- obviously correct.
--
-- It is not. project_files_owner_insert (0029) contains a subquery that counts
-- rows in storage.objects to enforce the 10-files-per-project cap. Reading
-- storage.objects from inside a policy ON storage.objects only works while
-- Postgres can flatten the reference; wrapping auth.uid() in a scalar
-- sub-select defeats that, the policy re-enters itself, and the insert fails
-- with:
--
--   ERROR: infinite recursion detected in policy for relation "objects"
--
-- Applied against the live database and caught by 0029's own three-case test
-- (case 1 — a legitimate upload into an owned project — failed outright), then
-- reverted. EVERY project-file upload was broken while it was in place. The
-- per-row evaluation of auth.uid() here is a real but small cost, and it is the
-- correct trade against breaking uploads entirely.
--
-- If this is ever revisited: the fix is to remove the self-referencing count
-- from the policy (e.g. move the cap into a trigger on storage.objects, the way
-- 0022 does it for the project_files table), NOT to wrap auth.uid().
--
-- The `objects.name` qualification inside the two subqueries is load-bearing
-- for a second, unrelated reason — see 0029's own comment before touching it.

drop policy if exists avatars_owner_read on storage.objects;
create policy avatars_owner_read on storage.objects
  for select using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '/avatar'
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects
  for update using (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '/avatar'
  )
  with check (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '/avatar'
  );

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists project_files_owner_select on storage.objects;
create policy project_files_owner_select on storage.objects
  for select using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists project_files_owner_delete on storage.objects;
create policy project_files_owner_delete on storage.objects
  for delete using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists project_files_owner_insert on storage.objects;
create policy project_files_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'project-files'
    and (storage.foldername(objects.name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.projects p
      where p.id::text = (storage.foldername(objects.name))[2]
        and p.user_id = auth.uid()
    )
    and (
      select count(*)
      from storage.objects o
      where o.bucket_id = 'project-files'
        and o.name like auth.uid()::text || '/' || (storage.foldername(objects.name))[2] || '/%'
    ) < 10
  );
