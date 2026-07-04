-- PromptPrinter — tighten profiles UPDATE to an explicit column allowlist
-- Run AFTER 0013_profile_admin_role.sql.
--
-- 0013's `revoke update (is_admin) on public.profiles from authenticated`
-- did not actually restrict anything: authenticated's UPDATE grant from 0002
-- is a TABLE-level grant, and Postgres tracks table-level and column-level
-- ACLs as separate entries. Revoking a column-level privilege that was never
-- separately granted is a no-op against a pre-existing table-level grant —
-- verified live (has_column_privilege('authenticated', 'profiles', 'is_admin',
-- 'UPDATE') still returned true after 0013).
--
-- The correct fix: remove the blanket table-level grant and replace it with
-- an explicit column allowlist covering exactly what the client legitimately
-- self-edits today (display_name via settings, avatar_url via avatar upload,
-- settings via onboarding/tool-defaults). `plan` and `is_admin` are both
-- server-only from here on — this also closes a pre-existing gap where a
-- signed-in user's own client could already update `plan` directly (e.g.
-- to "pro") via the same blanket grant, not just the new is_admin flag.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, settings) on public.profiles to authenticated;
