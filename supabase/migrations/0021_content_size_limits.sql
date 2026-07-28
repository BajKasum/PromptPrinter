-- PromptPrinter — CHECK constraints against unbounded client inserts (QA finding S-4)
-- Run AFTER 0020_user_api_keys_column_grants.sql.
--
-- `messages` and `generations` grant `insert` to `authenticated` (0009, 0001)
-- with no size limit at all: a signed-in user's own browser console can run
-- `supabase.from("generations").insert({ outputs: { prompt: "x".repeat(1e7) } })`
-- and Postgres accepts it (JSONB up to 1 GB). RLS scopes it to the caller's
-- own rows, so this isn't a data leak, just unbounded DB growth one account
-- can trigger on a Free/Pro Supabase plan — a cost/availability problem, not
-- a confidentiality one.
--
-- messages.content: 40000 matches MAX_ASSISTANT_MESSAGE_CHARS (chat-limits.ts,
-- QA finding F-2) — the more permissive of the app's own two application-level
-- ceilings (user messages are capped lower, at 8000, but this single
-- constraint only needs to bound the outer edge both roles must fit under).
-- generations.outputs: 200000 bytes of JSONB is comfortably above a real
-- saved prompt (a 40000-char prompt plus title/target sits far under this)
-- while still a real ceiling.
--
-- Deliberately not done here (see the finding's own steps 2-3, kept as a
-- follow-up, not silently dropped): a row-count cap via trigger (the same
-- technique as F-6's project_files trigger, just not built for these two
-- tables in this pass) and routing generations-insert through an API route
-- instead of a direct client insert (a bigger structural change, tracked
-- separately).
alter table public.messages
  add constraint messages_content_len check (char_length(content) <= 40000);

alter table public.generations
  add constraint generations_outputs_len check (pg_column_size(outputs) <= 200000);
