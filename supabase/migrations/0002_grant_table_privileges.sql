-- PromptPrinter — table privilege grants
-- Run AFTER 0001_init.sql.
--
-- 0001 enabled RLS and defined policies, but the tables were created without
-- DML GRANTs to the Supabase roles. RLS only filters rows AFTER base-table
-- privileges allow access, so authenticated users hit "permission denied" on
-- every select/insert. These grants give each role the least-privilege verbs
-- it needs; RLS still restricts every row to its owner (auth.uid()).

grant usage on schema public to anon, authenticated, service_role;

-- service_role bypasses RLS but still needs table grants for server-side ops
-- (e.g. the Stripe webhook writing subscriptions via the service key).
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- authenticated: only the verbs each table's policies actually use.
grant select, update                 on public.profiles      to authenticated;
grant select, insert, update, delete on public.projects      to authenticated;
grant select, insert                 on public.generations   to authenticated;
grant select                         on public.subscriptions to authenticated;

-- Future tables created in this schema inherit sane defaults.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
