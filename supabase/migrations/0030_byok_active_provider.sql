-- PromptPrinter — make the active BYOK key an explicit choice
-- (Security-Audit finding M-6)
-- Run AFTER 0029_project_files_storage_limits.sql.
--
-- byok.ts's getUserOverride() reads:
--     .order("created_at", { ascending: true }).limit(1)
-- i.e. the OLDEST key wins, silently. Meanwhile the settings UI
-- (getConfiguredProviders) lists every configured provider as "connected", and
-- the schema allows one row per (user, provider) — up to four. So a user who
-- connects Anthropic, then later OpenAI, sees both as connected while only
-- Anthropic is ever used, forever, with nothing anywhere saying so. If that
-- first key is later revoked at the provider, every chat turn fails and the
-- obvious remedy ("I'll add another key") does nothing.
--
-- "Whichever row happened to be inserted first" is not a decision a product
-- should be making on the user's behalf. This turns it into stored state they
-- control.

-- ─── The flag ──────────────────────────────────────────────────────────────
alter table public.user_api_keys
  add column if not exists is_active boolean not null default false;

-- Exactly one active row per user, enforced by the database rather than by
-- whichever code path happens to write next. Partial index: rows with
-- is_active = false are not covered, so a user may keep several inactive keys.
create unique index if not exists user_api_keys_one_active_per_user
  on public.user_api_keys (user_id)
  where is_active;

-- Backfill preserves TODAY's behaviour exactly rather than picking anew: the
-- oldest key per user becomes the active one, which is precisely the row
-- getUserOverride would have selected. Nobody's effective provider changes on
-- deploy; the difference is that it is now visible and changeable.
update public.user_api_keys k
set is_active = true
where k.id = (
  select k2.id
  from public.user_api_keys k2
  where k2.user_id = k.user_id
  order by k2.created_at asc
  limit 1
)
and not exists (
  select 1 from public.user_api_keys k3
  where k3.user_id = k.user_id and k3.is_active
);

-- ─── Switching ─────────────────────────────────────────────────────────────
-- Deactivate-then-activate has to be ONE statement: doing it as two client-side
-- updates would transiently leave either zero active rows (a chat in flight
-- falls back to the server key) or two (the unique index rejects the second
-- write and the user is stuck with the old one). A single UPDATE with a CASE
-- is atomic and can't half-apply.
--
-- security invoker + the explicit user_id filter: RLS on user_api_keys already
-- scopes this to the caller, and the filter is the same defense-in-depth this
-- project applies everywhere (0016's own convention).
create or replace function public.set_active_byok_provider(target_provider text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.user_api_keys
  set is_active = (provider = target_provider)
  where user_id = auth.uid();
$$;

grant execute on function public.set_active_byok_provider(text) to authenticated;

-- ─── Deleting the active key ───────────────────────────────────────────────
-- Without this, removing the active key leaves a user with keys but none
-- active, which silently drops them back onto the server's provider and its
-- plan limits — the same class of invisible behaviour this migration exists to
-- remove. Promotes the oldest remaining key instead.
create or replace function public.promote_next_byok_key()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.is_active then
    update public.user_api_keys
    set is_active = true
    where id = (
      select id from public.user_api_keys
      where user_id = old.user_id
      order by created_at asc
      limit 1
    );
  end if;
  return old;
end;
$$;

drop trigger if exists user_api_keys_promote_next on public.user_api_keys;
create trigger user_api_keys_promote_next
  after delete on public.user_api_keys
  for each row execute function public.promote_next_byok_key();

-- Trigger-only, same reasoning as 0003 and 0022: never needs to be RPC-callable.
revoke execute on function public.promote_next_byok_key() from public, anon, authenticated;

-- ─── Grants ────────────────────────────────────────────────────────────────
-- Column allowlist, matching the lesson 0014/0020/0026 already wrote down. The
-- client never writes is_active directly (it calls the RPC above), but the RPC
-- is `security invoker`, so the privilege has to exist for that role.
grant update (is_active) on public.user_api_keys to authenticated;

-- SELECT needs an explicit entry too, and this is exactly the trap 0020 set up:
-- that migration replaced the blanket table-level SELECT with a fixed column
-- allowlist, so a column added later is NOT readable by default. Verified live
-- right after adding the column — has_column_privilege(...,'is_active','SELECT')
-- came back FALSE, which would have made getActiveProvider() silently return
-- null for everyone and the settings UI show no active key at all.
--
-- Any future column on this table needs the same line. encrypted_key stays out,
-- deliberately and permanently (0020).
grant select (is_active) on public.user_api_keys to authenticated;
