-- PromptPrinter — BYOK: a generic "custom" provider slot
-- Run AFTER 0016_project_summaries.sql.
--
-- The fixed Anthropic/OpenAI/Gemini rows only cover three specific vendors.
-- Plenty of users (including the founder, on Z.ai) already hold a key for
-- some other OpenAI-compatible endpoint (Z.ai, DeepSeek, Groq, Mistral,
-- OpenRouter, a self-hosted gateway, …). Rather than hardcoding one more
-- named provider per request, this adds a single generic 'custom' slot: the
-- user supplies their own label, chat-completions endpoint URL, and model
-- name alongside the key. src/lib/llm.ts's customComplete() then speaks
-- plain OpenAI-compatible chat/completions to whatever endpoint they gave.

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'user_api_keys_provider_check') then
    alter table public.user_api_keys drop constraint user_api_keys_provider_check;
  end if;
end $$;

alter table public.user_api_keys
  add constraint user_api_keys_provider_check
  check (provider in ('anthropic', 'openai', 'gemini', 'custom'));

alter table public.user_api_keys add column if not exists label text;
alter table public.user_api_keys add column if not exists base_url text;
alter table public.user_api_keys add column if not exists model text;

-- A 'custom' row must carry its own endpoint/model/label; the named
-- providers must not (they get theirs from llm.ts's own constants).
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'user_api_keys_custom_fields_check') then
    alter table public.user_api_keys drop constraint user_api_keys_custom_fields_check;
  end if;
end $$;

alter table public.user_api_keys
  add constraint user_api_keys_custom_fields_check
  check (
    (provider = 'custom' and label is not null and base_url is not null and model is not null)
    or
    (provider <> 'custom' and label is null and base_url is null and model is null)
  );
