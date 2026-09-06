-- PromptPrinter — tote Stripe-Reste aus dem Schema entfernt
-- Run AFTER 0042_project_file_verified_size.sql.
--
-- B-11 aus dem Audit vom 06.09.2026, gefunden bei der Nachkontrolle der
-- mittleren Befunde. Stripe wurde ersatzlos durch Lemon Squeezy ersetzt
-- (siehe 0039_lemonsqueezy_billing.sql), im Code steckt seit Anfang August
-- keine Stripe-Referenz mehr — geprüft per Grep über src/ und package.json.
-- In der Datenbank standen trotzdem noch drei Reste aus 0001_init.sql:
--
-- 1. Die Tabelle `subscriptions` (stripe_subscription_id, stripe_price_id):
--    ihre Rolle übernehmen seit 0039 die subscription_*-Spalten auf profiles
--    plus billing_events. Kein Codepfad liest oder schreibt `subscriptions`
--    mehr (grep bestätigt).
-- 2. `profiles.stripe_customer_id`: ersetzt durch
--    `profiles.subscription_customer_id` (0039), ebenfalls ungelesen.
-- 3. `profiles_stripe_idx`: der Index auf die tote Spalte, vom
--    Supabase-Advisor als ungenutzt gemeldet.
--
-- `drop table` räumt die zugehörige Policy, den updated_at-Trigger und den
-- eigenen Index automatisch mit ab (CASCADE ist dafür nicht nötig, das sind
-- alles Objekte AUF der Tabelle). `drop index` vor `drop column`, weil ein
-- Index auf eine gerade gelöschte Spalte ohnehin automatisch verschwindet —
-- die explizite Reihenfolge ist hier nur Lesbarkeit, kein technisches
-- Erfordernis.

drop table if exists public.subscriptions;

drop index if exists public.profiles_stripe_idx;

alter table public.profiles
  drop column if exists stripe_customer_id;
