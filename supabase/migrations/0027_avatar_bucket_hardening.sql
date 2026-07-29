-- PromptPrinter — harden the public avatars bucket (Security-Audit finding H-1)
-- Run AFTER 0026_generations_owner_update.sql.
--
-- 0006 created `avatars` as a PUBLIC bucket with no file_size_limit and no
-- allowed_mime_types, and 0006/0007's policies check only the folder prefix
-- ((storage.foldername(name))[1] = auth.uid()::text). The only checks on what
-- may be uploaded lived in the browser (avatar-upload.tsx: file.type starts
-- with "image/", size <= 2 MB) — which is no check at all, since the upload
-- goes straight from the client to Storage and anyone can call the same
-- supabase-js method from a console with different arguments.
--
-- Two consequences, both real:
--   1. A public bucket serves back whatever content-type was stored, to anyone,
--      unauthenticated. That made the Supabase origin free hosting for
--      arbitrary files (phishing pages, malware) attributable to this project.
--   2. No size or object-count bound at all, so one account could fill it.
--
-- Not a cross-origin XSS against the app itself (storage is served from
-- <project>.supabase.co, a different origin than the app, so no session cookie
-- is reachable) — which is why this is a hardening pass, not an incident.
--
-- Three changes, all server-side:

-- 1) Bucket-level bounds. allowed_mime_types is enforced by Storage against the
--    declared content-type; file_size_limit against the actual body. 2 MB
--    matches MAX_AVATAR_BYTES (src/lib/avatar.ts). image/svg+xml is
--    deliberately excluded: an SVG can carry script, and this bucket is public.
update storage.buckets
set file_size_limit = 2097152, -- 2 MB, keep in sync with MAX_AVATAR_BYTES
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'avatars';

-- 2) Pin writes to the single path the app actually uses. The prefix check
--    allowed any name under the user's folder; the app has only ever written
--    "{uid}/avatar" (avatar-upload.tsx, and /api/account removes exactly that
--    path), so this narrows the policy to what the product already does and
--    rejects "{uid}/anything-else" outright. Verified against live data before
--    applying: the single existing object is already at this exact path.
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

-- 3) SELECT and DELETE deliberately keep the broader folder-prefix scope from
--    0006/0007. The owner's upsert needs SELECT alongside INSERT/UPDATE, and
--    keeping DELETE prefix-scoped means an owner (and /api/account's cleanup)
--    can still remove any stray object that predates this migration. Both stay
--    owner-scoped either way — neither widens access.
