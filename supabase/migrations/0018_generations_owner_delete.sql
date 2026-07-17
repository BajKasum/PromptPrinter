-- PromptPrinter — allow owners to delete their own saved results (Ergebnisse)
-- Run AFTER 0017_byok_custom_provider.sql.
--
-- Background: 0001 created public.generations as an append-only generation log
-- (SELECT + INSERT only, no DELETE). With the 2026-07 "Ergebnisse"-Neubau the
-- same table now stores user-saved prompts ("Prompt speichern" aus dem Chat,
-- outputs = { prompt, title, target }), which the owner must be able to remove
-- again from their Ergebnisse. This adds the missing DELETE policy + grant,
-- scoped to the row owner exactly like the existing SELECT/INSERT policies.
-- Purely additive: no data touched, no column change. Safe to re-run.

drop policy if exists generations_owner_delete on public.generations;
create policy generations_owner_delete on public.generations
  for delete using (auth.uid() = user_id);

grant delete on public.generations to authenticated;
