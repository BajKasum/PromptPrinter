-- PromptPrinter — Kundenportal-Adresse aus Lemon Squeezy festhalten
-- Run AFTER 0040_messages_owner_delete.sql.
--
-- M-2 (Audit 06.09.2026): ein aktives Pro-Abo liess sich in der App nirgends
-- kuendigen — der einzige Satz zur Kuendigung stand in einem Zweig von
-- billing/page.tsx, den ein laufendes Abo nie erreicht (er greift nur, wenn
-- subscription_renews_at NICHT gesetzt ist; der Webhook setzt es aber bei
-- jedem aktiven Abo). Lemon Squeezy liefert die Kundenportal-Adresse
-- (attributes.urls.customer_portal) auf jedem Abo-Ereignis mit, sie wurde
-- nur nie gespeichert.
--
-- Dieselbe Grant-Logik wie die anderen subscription_*-Spalten (0039): lesen
-- ja, schreiben nur der Service-Role-Client im Webhook — sonst koennte sich
-- jeder Nutzer eine beliebige URL ins eigene Profil schreiben, die die
-- Abrechnungsseite dann ungeprueft als Link ausgibt.

alter table public.profiles
  add column if not exists subscription_portal_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_subscription_portal_url_len'
  ) then
    alter table public.profiles
      add constraint profiles_subscription_portal_url_len check (
        char_length(subscription_portal_url) <= 2000
      );
  end if;
end $$;

grant select (subscription_portal_url) on public.profiles to authenticated;
