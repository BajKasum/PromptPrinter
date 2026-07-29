-- PromptPrinter — drop the non-DML grants anon/authenticated never needed
-- (Security-Audit finding M-3)
-- Run AFTER 0027_avatar_bucket_hardening.sql.
--
-- Every table in `public` carried TRUNCATE, REFERENCES, TRIGGER and MAINTAIN
-- for BOTH `anon` and `authenticated` — 8 tables x 4 privileges x 2 roles.
-- Nothing in this project granted them: they come from Supabase's stock
-- `ALTER DEFAULT PRIVILEGES ... GRANT` for the public schema, and while every
-- migration here was careful about DML (0002's least-privilege verbs, 0014 and
-- 0020's revoke-then-regrant column allowlists, 0026's single-column UPDATE),
-- none of them touched the non-DML verbs, because nothing made them visible.
--
-- WHY TRUNCATE IS THE ONE THAT MATTERS: it is not filtered by RLS. Every other
-- privilege these roles hold is row-scoped by a policy — DELETE included, which
-- is why owner-scoped DELETE is safe. A single successful
-- `TRUNCATE public.messages` would remove every user's data regardless of any
-- policy. It is the one verb in the set that turns a foothold into total loss.
--
-- NOT EXPLOITABLE TODAY — verified before writing this, and worth recording so
-- the next reader doesn't assume it was: PostgREST exposes no HTTP verb that
-- maps to TRUNCATE, and every function in `public` was enumerated for a path to
-- one. Only project_summaries() is EXECUTE-able by anon/authenticated, it is
-- `security invoker`, and it only reads. handle_new_user, set_updated_at,
-- enforce_project_file_limit and rls_auto_enable are all revoked from both
-- roles already (0003, 0022).
--
-- So this is defence in depth, not an incident response. It matters because the
-- gap is one `security definer` helper away from being reachable, and because
-- an unused grant is indistinguishable from an intended one to whoever reads
-- this schema next.
--
-- REFERENCES/TRIGGER/MAINTAIN go with it for the same reason: all three are DDL
-- or maintenance verbs, the app's roles never run DDL (migrations run as
-- `postgres`), and MAINTAIN (new in PG 17, which this project is on — 17.6,
-- verified) would let these roles run VACUUM/ANALYZE/REINDEX against tables
-- they can otherwise only read their own rows from.
revoke truncate, references, trigger, maintain
  on all tables in schema public
  from anon, authenticated;

-- Without this the next `create table` in public re-grants all four: the
-- default privileges are what produced this state in the first place, so
-- revoking only the current tables would fix the symptom and leave the cause.
-- Scoped `for role postgres` because that is the grantor recorded in
-- pg_default_acl for this schema (verified) — migrations create tables as
-- postgres, so this is the entry that actually applies to them.
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain
  on tables from anon, authenticated;

-- Deliberately untouched:
--   * service_role keeps everything — it bypasses RLS by design and is the
--     server-side identity for admin operations (createAdminClient).
--   * The DML grants from 0002/0009/0012/0015/0018/0026 and the column
--     allowlists from 0014/0020/0026. This migration names only the four
--     non-DML verbs, so a targeted REVOKE cannot disturb them.
--   * The `storage` schema, whose own defaults are broader still but whose
--     objects are governed by the bucket policies in 0006/0007/0012/0027.
--     Narrowing those is a separate change with its own blast radius.
--
-- KNOWN REMAINDER, stated rather than glossed over: pg_default_acl still holds a
-- SECOND entry for public tables, granted by `supabase_admin`, which hands
-- anon/authenticated the full `arwdDxtm` set. It is not reachable from here —
-- ALTER DEFAULT PRIVILEGES can only be run by (or for) the grantor role, and
-- supabase_admin is platform-managed, not an account this project controls.
--
-- It does not affect this schema in practice: default privileges apply per
-- CREATING role, and every table in `public` is created by `postgres` (that is
-- how migrations run, confirmed by pg_class.relowner on all 8 tables). The
-- supabase_admin entry would only bite if Supabase itself created a table in
-- `public` on our behalf. Verified after this migration: anon holds zero
-- privileges on all 8 existing tables, and the postgres default ACL no longer
-- names anon or authenticated at all.
--
-- Re-check this if a future table ever shows up owned by something other than
-- `postgres` — that is the one condition under which the remainder matters.
