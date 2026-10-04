-- PromptPrinter — function hardening
-- Run AFTER 0002. Addresses Supabase security-advisor warnings.

-- 1) Pin search_path so these functions can't be hijacked by objects in an
--    attacker-controlled schema. References are schema-qualified (public.profiles)
--    or pg_catalog built-ins (now/coalesce/split_part), which resolve under ''.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2) These run only from triggers (table + event), never via the REST API.
--    Triggers fire regardless of EXECUTE grants, so revoking removes the
--    needless /rest/v1/rpc exposure the linter flagged.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at()  from public, anon, authenticated;

-- rls_auto_enable() ist keine Funktion dieses Repos: Supabase legt sie auf
-- gehosteten Projekten selbst an (Event-Trigger "ensure_rls", schaltet RLS auf
-- neuen Tabellen im public-Schema ein). In einem lokalen Stack (supabase start,
-- die Ende-zu-Ende-Tests) gibt es sie nicht, und ein unbedingtes REVOKE brach
-- dort die ganze Kette ab: das Schema liess sich aus dem Repository nicht
-- nachbauen (Betriebs-Audit, M1/M2, 05.10.2026). Bedingt ausgefuehrt ist die
-- Wirkung auf einem gehosteten Projekt, wo die Funktion existiert, dieselbe wie
-- zuvor.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
