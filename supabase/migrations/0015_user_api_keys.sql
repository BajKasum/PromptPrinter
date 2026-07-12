-- PromptPrinter — user-supplied AI provider API keys (BYOK)
-- Run AFTER 0014_profile_column_grants.sql.
--
-- One row per (user, provider). The key itself never sits in plaintext here:
-- `encrypted_key` is a single opaque base64 blob (iv + GCM auth tag +
-- ciphertext, packed together by src/lib/crypto.ts) produced with a
-- server-only secret (API_KEY_ENCRYPTION_SECRET) that lives only in the app's
-- environment, never in this database. Even a full DB dump yields nothing
-- usable without that secret.
--
-- `zai` is deliberately not an allowed provider — Z.ai is the platform's own
-- default (llm.ts), not something a user brings their own key for; BYOK only
-- covers the providers actually worth a user having a spare key for.
create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('anthropic', 'openai', 'gemini')),
  encrypted_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);
create index if not exists user_api_keys_user_idx on public.user_api_keys(user_id);

-- ─── Row Level Security ────────────────────────────────────────────────────
-- Owner-scoped, same shape as project_files (0012).
alter table public.user_api_keys enable row level security;

drop policy if exists user_api_keys_owner on public.user_api_keys;
create policy user_api_keys_owner on public.user_api_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Privilege grants ──────────────────────────────────────────────────────
-- Explicit allowlist, not a blanket grant (0014's lesson) — but every column
-- here is legitimately client-writable via the owning user's own save/remove
-- action (through the request-scoped client in api/settings/api-key), so the
-- allowlist covers the whole row rather than excluding anything.
grant select, insert, update, delete on public.user_api_keys to authenticated;
