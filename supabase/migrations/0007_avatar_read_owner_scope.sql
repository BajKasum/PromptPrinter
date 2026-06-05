-- PromptPrinter — tighten avatar read access
-- Replaces the broad public SELECT policy on the avatars bucket with an
-- owner-scoped one. Resolves security advisor 0025 (public_bucket_allows_listing):
-- a public bucket that also has a `bucket_id = 'avatars'` SELECT policy lets any
-- client LIST every object, which leaks the per-user folder names (= user ids).
--
-- Public buckets bypass RLS for downloads, so avatar <img> URLs keep rendering
-- without any SELECT policy at all. The owner-scoped SELECT below exists only so
-- the owner's upload upsert — which needs SELECT + UPDATE on top of INSERT — keeps
-- working. Anonymous clients can no longer enumerate the bucket.

drop policy if exists avatars_public_read on storage.objects;

create policy avatars_owner_read on storage.objects
  for select using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
