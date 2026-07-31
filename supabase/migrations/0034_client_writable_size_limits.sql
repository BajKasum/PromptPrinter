-- PromptPrinter — bound the remaining client-writable columns
-- Run AFTER 0033_list_ordering_indexes.sql.
--
-- 0021 added CHECK constraints against unbounded client inserts, but only for
-- messages.content and generations.outputs. Every other column the browser can
-- write stayed unbounded. Confirmed against the live database: the only CHECK
-- constraints on these tables are 0021's two, plus the plan/status/type/role
-- enum checks.
--
-- The app caps all of these in its own UI (project name 80 via /api/projects'
-- zod schema, instructions 4000 via project-rail.tsx, display_name 60 via the
-- settings input, conversations.title 60 via deriveTitle, target 40 via
-- chatRequestSchema) — but those run in the client or in a route the client can
-- simply not use. `authenticated` holds a direct column-level UPDATE grant on
-- every column below, so a signed-in user can write whatever they like straight
-- from the browser console. That is the same gap 0021/0022 closed for two
-- tables and one trigger; this closes it for the rest.
--
-- profiles.settings deserves its own mention: it is read on EVERY authenticated
-- page render (the app layout selects it for the onboarding flag), so an
-- oversized blob there is not just stored, it is re-fetched on every navigation.
--
-- Limits are deliberately several times the app's own, so this can only ever
-- catch abuse, never a legitimate edit. Verified before applying that the
-- largest existing value in each column is far below its new bound (biggest:
-- avatar_url at 133 chars, title at 58, settings at 28 bytes).
--
-- No constraint on projects.tools/context VALUES individually — pg_column_size
-- on the whole JSONB bounds the abuse axis, and per-key limits would duplicate
-- STRUCTURE_FIELDS from project-rail.tsx into SQL where it would drift.

alter table public.profiles
  add constraint profiles_display_name_len check (char_length(display_name) <= 200),
  add constraint profiles_avatar_url_len check (char_length(avatar_url) <= 1000),
  add constraint profiles_settings_size check (pg_column_size(settings) <= 8000);

alter table public.projects
  add constraint projects_name_len check (char_length(name) <= 200),
  add constraint projects_instructions_len check (char_length(instructions) <= 8000),
  add constraint projects_idea_len check (char_length(idea) <= 8000),
  add constraint projects_audience_len check (char_length(audience) <= 500),
  add constraint projects_context_size check (pg_column_size(context) <= 8000),
  add constraint projects_tools_size check (pg_column_size(tools) <= 4000);

alter table public.conversations
  add constraint conversations_title_len check (char_length(title) <= 300),
  add constraint conversations_target_len check (char_length(target) <= 100);
