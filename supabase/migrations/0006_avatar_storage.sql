-- PromptPrinter — avatar storage
-- Public bucket for profile pictures, with per-user write isolation.

-- ─── avatars bucket ────────────────────────────────────────────────────────
-- Public so the stored URL renders without a signed request. Files live under
-- a per-user folder ("{uid}/avatar"), which the policies below pin to the owner.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ─── Row Level Security on storage.objects ─────────────────────────────────
-- Anyone may read avatars (the bucket is public); only the owner may write to
-- their own folder. (storage.foldername(name))[1] is the first path segment.

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
