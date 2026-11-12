-- PromptPrinter — die Byte-Grenze für gespeicherte Prompts gilt auch beim Ändern
--
-- 0051 prüft die Obergrenze je Konto (20 MiB in outputs, ACCOUNT_CEILINGS.savedPrompts in shared/lib/plans.ts) nur nach
-- einem INSERT. outputs darf authenticated aber ändern (Spaltenrecht aus 0026, so speichert die Liste einen bearbeiteten
-- Prompt), bis 200 000 Bytes je Zeile (0021). Viele kleine Zeilen anlegen und danach jede vergrössern brachte ein Konto
-- so auf rund 1 GB statt 20 MiB.
--
-- Dieser Trigger prüft nach jedem UPDATE die Summe jedes Kontos, dessen outputs die Anweisung geändert hat, gezählt wie
-- in 0051 als belegter Platz in der Tabelle (pg_column_size). Er nimmt dieselbe Sperre wie 0051 (gleicher Schlüssel),
-- damit ein Einfügen und ein Ändern desselben Kontos nicht gleichzeitig an der Grenze vorbeikommen.
--
-- Bewusst kein Vergleich "wird es grösser?": In der Transition-Tabelle stehen die neuen Werte unkomprimiert, die alten so,
-- wie sie gespeichert sind, beide lassen sich also nicht gleich messen; und ein kürzerer Text kann mehr Platz belegen,
-- wenn er sich schlechter komprimieren lässt. Folge: Ein Konto über der Grenze kann gespeicherte Prompts lesen und löschen,
-- aber nicht ändern, bis es darunter liegt. Normale Nutzung stösst nicht an (am 2026-11-12 belegte das grösste Konto in
-- Produktion 4,6 kB).
--
-- Transition-Tabellen vertragen keine Spaltenliste (`after update of outputs`), deshalb läuft er bei jedem UPDATE der
-- Tabelle und sucht die geänderten Werte selbst.
--
-- Rückgängig:
--   drop trigger if exists saved_prompts_account_ceiling_update on public.saved_prompts;
--   drop function if exists public.enforce_saved_prompts_bytes_on_update();
--
-- Wiederholbar: Funktion per create or replace, Trigger wird vorher entfernt.

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
  for account in
    select distinct n.user_id
    from new_rows n
    join old_rows o on o.id = n.id
    where n.outputs is distinct from o.outputs
    order by n.user_id
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

drop trigger if exists saved_prompts_account_ceiling_update on public.saved_prompts;
create trigger saved_prompts_account_ceiling_update after update on public.saved_prompts
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.enforce_saved_prompts_bytes_on_update('20971520');
