-- PromptPrinter — bound the project-files BUCKET, not just the table
-- (Security-Audit finding M-2)
-- Run AFTER 0028_revoke_non_dml_grants.sql.
--
-- 0022 put the 10-files-per-project rule and the extension allowlist into a
-- trigger on public.project_files. That is a real fix for the TABLE — but
-- uploads run directly from the browser to Storage (project-files.tsx: upload
-- first, insert the row second), and the storage policy checked only the folder
-- prefix:
--     bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()
-- Nothing required a matching row to ever be inserted. A user could upload
-- objects and simply never insert, and the trigger would never fire. The bucket
-- was bounded only by file_size_limit (200 KB each) and nothing at all on count.
--
-- The path shape is `{uid}/{projectId}/{fileId}-{name}`, so a naive per-project
-- count would be trivially bypassed: projectId is a CLIENT-CHOSEN path segment,
-- and inventing a fresh one buys another 10 slots, forever. The EXISTS below is
-- what actually closes it — the second segment has to name a project this user
-- really owns, and project count is itself capped per plan (plans.ts,
-- /api/projects). Together that bounds total storage per account instead of
-- moving the unbounded axis one level down.
-- NOTE ON `objects.name`: every reference to the NEW row's path is qualified.
-- Writing a bare `name` inside these subqueries silently binds to the SUBQUERY's
-- own table — `projects` has a `name` column (the project title!) and
-- `storage.objects o` has one too. An unqualified first draft of this policy
-- compiled and applied cleanly while comparing a project's TITLE against a path
-- segment, which would have rejected every upload. Postgres resolves the
-- innermost match; only the qualification makes the intent binding.
drop policy if exists project_files_owner_insert on storage.objects;
create policy project_files_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'project-files'
    -- Unchanged from 0012: first segment is the owner.
    and (storage.foldername(objects.name))[1] = auth.uid()::text
    -- Second segment must be a project this user actually owns.
    and exists (
      select 1
      from public.projects p
      where p.id::text = (storage.foldername(objects.name))[2]
        and p.user_id = auth.uid()
    )
    -- Same ceiling as MAX_FILES_PER_PROJECT (project-files.ts) and 0022's
    -- trigger. Three copies of "10" now; they are listed in that file's comment.
    -- Written as a LIKE prefix rather than foldername() on every row so the
    -- count can use storage.objects' (bucket_id, name) index instead of
    -- computing foldername() for the whole bucket.
    and (
      select count(*)
      from storage.objects o
      where o.bucket_id = 'project-files'
        and o.name like auth.uid()::text || '/' || (storage.foldername(objects.name))[2] || '/%'
    ) < 10
  );

-- Verified against the live database before committing, as `authenticated` with
-- a real user's JWT claims, in a transaction that was rolled back:
--   1. upload into an owned project      -> ACCEPTED
--   2. upload under an invented project  -> REJECTED
--   3. eleventh file in one project      -> REJECTED
-- Reading the policy expression is not the same as running it; case 1 is what
-- catches the scoping bug described above.

-- Deliberately NOT adding allowed_mime_types to this bucket, and that is a
-- decision rather than an omission: 0012 already reasoned it through and
-- rejected it, because browsers report inconsistent MIME types for .md and .csv
-- across OS/browser (project-files.tsx falls back to "text/plain" for exactly
-- that reason). An allowlist here would reject legitimate uploads on some
-- machines and not others — the worst kind of bug to debug.
--
-- The extension allowlist stays where it can be enforced reliably: 0022's
-- trigger on the row. What remains possible is an object whose CONTENT is not
-- text, uploaded without a row — but this bucket is private (no public URL,
-- 0012), it is only ever read back server-side and decoded as text
-- (project-context.ts), and the count cap above now bounds how many such
-- objects can exist. Cost is bounded; nothing is served to anyone.
