-- PromptPrinter — initial schema
-- Run in Supabase SQL editor or `supabase db push`.

-- ─── Extensions ────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── profiles ──────────────────────────────────────────────────────────────
-- Mirrors auth.users with public-safe profile fields and plan state.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free','pro','team')),
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_stripe_idx on public.profiles(stripe_customer_id);

-- ─── projects ──────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  audience text not null,
  idea text not null,
  tools jsonb not null,
  status text not null default 'ready' check (status in ('draft','generating','ready','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_created_idx
  on public.projects(user_id, created_at desc);

-- ─── generations ───────────────────────────────────────────────────────────
-- One row per generation run; outputs is the full JSON artifact bundle.
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  outputs jsonb not null,
  model text,
  latency_ms int,
  tokens_in int,
  tokens_out int,
  created_at timestamptz not null default now()
);
create index if not exists generations_project_created_idx
  on public.generations(project_id, created_at desc);
create index if not exists generations_user_created_idx
  on public.generations(user_id, created_at desc);

-- ─── subscriptions ─────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists subscriptions_user_idx on public.subscriptions(user_id);

-- ─── updated_at trigger ────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ─── auto-create profile on signup ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.generations enable row level security;
alter table public.subscriptions enable row level security;

-- profiles: a user can read and update only their own profile
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (auth.uid() = id);
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- projects: full CRUD scoped to owner
drop policy if exists projects_owner on public.projects;
create policy projects_owner on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- generations: read/insert scoped to owner; no client updates
drop policy if exists generations_owner_select on public.generations;
create policy generations_owner_select on public.generations
  for select using (auth.uid() = user_id);
drop policy if exists generations_owner_insert on public.generations;
create policy generations_owner_insert on public.generations
  for insert with check (auth.uid() = user_id);

-- subscriptions: read-only for owner; writes via service role only
drop policy if exists subscriptions_owner_select on public.subscriptions;
create policy subscriptions_owner_select on public.subscriptions
  for select using (auth.uid() = user_id);
