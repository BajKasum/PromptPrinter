-- PromptPrinter — die Byte-Grenze beim Ändern gespeicherter Prompts plant jeden Aufruf neu
-- Run AFTER 0061_saved_prompt_versions.sql. Kein Code braucht diese Migration, und sie braucht keinen Code.
--
-- enforce_saved_prompts_bytes_on_update() (Trigger aus 0058) sucht die Konten, deren outputs ein UPDATE geändert hat,
-- mit einem Join der Transition-Tabellen new_rows und old_rows. Eine feste Abfrage behält plpgsql je Verbindung mit
-- dem Plan ihres ersten Aufrufs, geplant mit den Zeilenzahlen dieses Aufrufs. Änderte der eine Zeile, verbindet der
-- behaltene Plan auch 5 000 geänderte Zeilen Zeile für Zeile, und ein Update über 5 000 Prompts braucht ein
-- Vielfaches (im Nachbau mit PGlite 7 bis 30 s statt unter 0,6 s, Zahlen im Changelog) und kann in die Zeitgrenze
-- der Data API laufen. EXECUTE plant jeden Aufruf mit den echten Zahlen, wie log_saved_prompt_versions() aus 0061.
--
-- Sonst gilt alles wie in 0058: dieselbe Sperre je Konto vor dem Zählen (Schlüssel wie 0051), dieselbe Summe
-- (pg_column_size), dieselbe Meldung (P0001), security invoker, search_path leer, für niemanden per RPC aufrufbar.
-- Der Trigger bleibt, wie er ist: create or replace behält die Funktion, auf die er zeigt, und plpgsql übersetzt die
-- neue Fassung beim nächsten Aufruf, ein schon behaltener Plan der alten fällt dabei weg.
--
-- Rückgängig: die Funktion aus 0058 erneut anlegen (create or replace), der Trigger bleibt.
--
-- Wiederholbar: create or replace, das revoke darf mehrfach laufen.

create or replace function public.enforce_saved_prompts_bytes_on_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  max_bytes bigint := tg_argv[0]::bigint;
  account uuid;
  used_bytes bigint;
begin
  for account in execute $sql$
    select distinct n.user_id
    from new_rows n
    join old_rows o on o.id = n.id
    where n.outputs is distinct from o.outputs
    order by n.user_id
  $sql$
  loop
    perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || account::text, 0));

    select coalesce(sum(pg_column_size(outputs)), 0)
    into used_bytes
    from public.saved_prompts
    where user_id = account;

    if used_bytes > max_bytes then
      raise exception 'Obergrenze des Kontos erreicht: % (% Bytes)', tg_table_name, max_bytes;
    end if;
  end loop;

  return null;
end;
$$;

-- Läuft nur aus dem Trigger, muss nie per RPC aufrufbar sein (wie 0051).
revoke execute on function public.enforce_saved_prompts_bytes_on_update() from public, anon, authenticated;
