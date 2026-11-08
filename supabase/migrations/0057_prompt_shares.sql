-- PromptPrinter — einen gespeicherten Prompt per Link teilen
--
-- Ein gespeicherter Prompt bekommt auf Wunsch ein zufälliges Token; die öffentliche Seite /geteilt/<token> zeigt dann
-- den Prompt und seinen Titel, nichts über die Person dahinter. Widerrufen löscht die Zeile, der Link führt danach ins
-- Leere. Löscht jemand den Prompt oder das Konto, geht die Freigabe mit.
--
--   token       32 Zeichen base64url aus 24 Zufallsbytes (server/prompt-share.ts), nicht erratbar
--   prompt_id   höchstens eine Freigabe je Prompt
--   user_id     Eigentümer. Der zusammengesetzte Fremdschlüssel (prompt_id, user_id) auf saved_prompts (id, user_id)
--               hält in der Datenbank fest, dass nur der Eigentümer eines Prompts ihn freigeben kann.
--
-- Rechte: schreiben nur der Server (Service-Role) über /api/prompts/<id>/share, nach Prüfung der Sitzung, mit
-- Ratenlimit. Die Person liest ihre eigenen Freigaben (Policy unten). `anon` bekommt nichts: die öffentliche Seite liest
-- serverseitig, nur über das Token, nur geteilte Zeilen.
--
-- Rückgängig:
--   drop table if exists public.prompt_shares;
--   alter table public.saved_prompts drop constraint if exists saved_prompts_id_user_key;
--
-- Wiederholbar: jeder Schritt prüft, ob er schon gelaufen ist.

-- Ziel des zusammengesetzten Fremdschlüssels. id ist schon eindeutig, das Paar damit auch; der Index ist der Preis.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.saved_prompts'::regclass and conname = 'saved_prompts_id_user_key'
  ) then
    alter table public.saved_prompts add constraint saved_prompts_id_user_key unique (id, user_id);
  end if;
end
$$;

create table if not exists public.prompt_shares (
  token text primary key,
  prompt_id uuid not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint prompt_shares_token_format check (token ~ '^[A-Za-z0-9_-]{32}$'),
  constraint prompt_shares_prompt_owner_fkey foreign key (prompt_id, user_id)
    references public.saved_prompts (id, user_id) on delete cascade
);

create index if not exists prompt_shares_user_idx on public.prompt_shares (user_id);

alter table public.prompt_shares enable row level security;

drop policy if exists prompt_shares_owner_select on public.prompt_shares;
create policy prompt_shares_owner_select on public.prompt_shares
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.prompt_shares from anon, authenticated;
grant select on public.prompt_shares to authenticated;
