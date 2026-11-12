-- PromptPrinter — den aktiven eigenen Key schaltet nur noch der Server um
--
-- Die Route api/settings/api-key schreibt user_api_keys mit dem Service-Role-Schlüssel, 0060 entzieht authenticated die
-- Schreibrechte. Das Umschalten muss eine einzige Anweisung bleiben, sonst gäbe es kurz keinen oder zwei aktive Keys
-- (der partielle Unique-Index aus 0030 lehnt zwei ab), also eine Funktion wie set_active_byok_provider aus 0030. Mit dem
-- Service-Role-Schlüssel ist auth.uid() leer, deshalb nimmt diese Fassung das Konto als Argument und ist nur für
-- service_role ausführbar. Die Route übergibt die geprüfte Sitzung, nie eine Angabe aus dem Browser.
--
-- Nur hinzufügend: der heutige Code ruft sie nicht auf, die Migration kann vor dem Code laufen.
--
-- Rückgängig: `drop function if exists public.set_active_byok_provider_for(uuid, text);` (erst nach 0060 rückgängig,
-- sonst kann die Route nicht mehr umschalten).

create or replace function public.set_active_byok_provider_for(target_user uuid, target_provider text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.user_api_keys
  set is_active = (provider = target_provider)
  where user_id = target_user;
$$;

revoke execute on function public.set_active_byok_provider_for(uuid, text) from public, anon, authenticated;
grant execute on function public.set_active_byok_provider_for(uuid, text) to service_role;
