-- PromptPrinter — persist Prompt-Chats
-- Phase 2 of the "print prompts, not rigid projects" pivot: the chat is no
-- longer throwaway. Each conversation and every message is stored so a user can
-- reopen a chat and keep refining instead of starting over.
--
-- Two tables mirroring the projects/generations pattern:
--   conversations — one row per chat (mode + optional target assistant + title)
--   messages      — append-only transcript, one row per turn
-- Both carry user_id so the RLS owner policy is a simple auth.uid() check, the
-- same shape used by generations.

-- ─── conversations ─────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null default 'general' check (mode in ('general','software')),
  target text,
  title text not null default 'Neuer Chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_updated_idx
  on public.conversations(user_id, updated_at desc);

-- ─── messages ──────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at asc);

-- ─── updated_at trigger ────────────────────────────────────────────────────
-- Reuses the set_updated_at() function from 0001 so a continued chat sorts to
-- the top of the list.
drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- conversations: full CRUD scoped to owner
drop policy if exists conversations_owner on public.conversations;
create policy conversations_owner on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- messages: read/insert scoped to owner; no client updates (append-only).
-- Deletion happens via the conversations FK cascade, not direct client deletes.
drop policy if exists messages_owner_select on public.messages;
create policy messages_owner_select on public.messages
  for select using (auth.uid() = user_id);
drop policy if exists messages_owner_insert on public.messages;
create policy messages_owner_insert on public.messages
  for insert with check (auth.uid() = user_id);

-- ─── Privilege grants ──────────────────────────────────────────────────────
-- New tables need explicit DML grants for the authenticated role; RLS only
-- filters rows AFTER base-table privileges allow access (see 0002).
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert                 on public.messages      to authenticated;
