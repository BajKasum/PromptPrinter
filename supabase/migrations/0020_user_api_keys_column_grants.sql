-- PromptPrinter — restrict user_api_keys SELECT to an explicit column allowlist (QA finding S-3)
-- Run AFTER 0019_messages_monthly_quota_idx.sql.
--
-- 0015 granted `select, insert, update, delete on public.user_api_keys to
-- authenticated` — a TABLE-level grant covering every column, including
-- encrypted_key. No client legitimately needs it: the settings UI reads only
-- provider/label/base_url/model (getConfiguredProviders/getCustomProvider),
-- and the only place encrypted_key is ever read is byok.ts's
-- getUserOverride() — which runs through the request-scoped client and is
-- therefore itself subject to the `authenticated` role's own grants. Every
-- signed-in user could read their own ciphertext straight from the browser.
--
-- No direct exploit today (AES-256-GCM, key not in the DB), but it turns a
-- future leak of API_KEY_ENCRYPTION_SECRET into an instant mass-decrypt
-- instead of one that also needs DB access, and an XSS or compromised
-- extension could exfiltrate the ciphertext right now. Same lesson 0014
-- already wrote down for `profiles`: revoke the table-level grant first
-- (a column-level revoke against a pre-existing table-level grant is a
-- no-op, verified there), then re-grant an explicit allowlist.
--
-- INSERT/UPDATE keep writing encrypted_key (that's the whole point of the
-- table) — those paths already run exclusively server-side in
-- /api/settings/api-key, this migration only tightens the read side, which
-- is the one path an ordinary signed-in browser session can reach today.
revoke select on public.user_api_keys from authenticated;
grant select (id, user_id, provider, label, base_url, model, created_at)
  on public.user_api_keys to authenticated;
