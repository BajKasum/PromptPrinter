-- PromptPrinter — project files (REDESIGN.md, Phase 4)
-- Run AFTER 0011_workspace_projects.sql.
--
-- Small, text-only context files a user attaches to a project workspace —
-- .md/.txt/.json/.csv, injected into every project chat's system prompt
-- (buildProjectContext, api/chat/route.ts). Deliberately no binary formats:
-- without a real GEMINI_API_KEY yet, anything that isn't plain text is dead
-- weight, and the point is token-efficient context, not a general file
-- manager. Allowlist + the 200 KB / 10-files caps live in
-- src/lib/project-files.ts and are enforced client-side; the bucket's own
-- file_size_limit below is the byte-based server-side backstop (a MIME
-- allowlist would be too unreliable — browsers report inconsistent types
-- for .md across OS/browser).

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime text,
  size_bytes int not null,
  created_at timestamptz not null default now()
);
create index if not exists project_files_project_idx
  on public.project_files(project_id, created_at asc);

-- ─── Row Level Security ────────────────────────────────────────────────────
-- Same shape as conversations (0009): owner-scoped by user_id alone, no
-- separate check that project_id actually belongs to that user — consistent
-- with how conversations.project_id is already handled in this codebase.
alter table public.project_files enable row level security;

drop policy if exists project_files_owner on public.project_files;
create policy project_files_owner on public.project_files
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Privilege grants ──────────────────────────────────────────────────────
-- No update grant: a file row is never edited in place, only replaced via
-- delete + re-upload.
grant select, insert, delete on public.project_files to authenticated;

-- ─── project-files storage bucket ──────────────────────────────────────────
-- Private (unlike the public avatars bucket) — content is only ever read back
-- server-side for context injection, never rendered as a public URL, so
-- downloads must go through RLS too (see the select policy below).
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 204800)
on conflict (id) do nothing;

drop policy if exists project_files_owner_insert on storage.objects;
create policy project_files_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'project-files'
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
