-- PromptPrinter — ein Konto mit aktivem eigenem Key lässt sich wieder löschen
--
-- Der Trigger user_api_keys_promote_next läuft nach dem Löschen eines Keys und setzt den nächsten aktiv. Kommt das Löschen
-- als Kaskade aus auth.users, feuert er erst am Ende des äusseren Befehls und damit unter der Rolle des Auth-Servers
-- (supabase_auth_admin). Die darf public.user_api_keys nicht ändern, Postgres bricht ab, und das ganze Löschen scheitert:
-- /api/account antwortete 500, das Konto blieb bestehen. e2e/account-deletion.spec.ts hält das fest.
--
-- Mit security definer läuft die Funktion unter ihrem Eigentümer. Sie ändert nur Zeilen des Kontos, dessen Key gerade
-- gelöscht wurde. Aufrufen kann sie niemand: Trigger brauchen kein Ausführungsrecht, search_path steht schon leer.
--
-- Rückgängig: `alter function public.promote_next_byok_key() security invoker;` Dann scheitert das Löschen wieder.
--
-- Wiederholbar.

alter function public.promote_next_byok_key() security definer;

revoke execute on function public.promote_next_byok_key() from public, anon, authenticated, service_role;
