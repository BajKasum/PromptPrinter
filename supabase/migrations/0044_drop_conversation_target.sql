-- PromptPrinter — Ziel-Tool komplett entfernen (Audit 23.09.2026)
-- Run AFTER 0043_drop_stripe_remnants.sql, and only once the code that no
-- longer reads or writes conversations.target is deployed: the previous code
-- writes `target` on every chat turn and would fail against a dropped column.
--
-- Die Ziel-Tool-Auswahl im Chat (QA F-3, 28.07.2026) ist auf Kasums Wunsch
-- wieder weg: niemand hat sie benutzt, und im Audit-Test ignorierte das
-- Modell das gewaehlte Tool ohnehin und fragte trotzdem danach. Finn fragt im
-- Gespraech selbst nach dem Tool (CHAT_SYSTEM_PROMPT). Mit der Auswahl gehen
-- drei Ablagen dieses Werts:
--
--   1. conversations.target — die Spalte selbst. Ihr CHECK
--      (conversations_target_len, 0034) und etwaige Spalten-Grants fallen
--      mit ihr weg.
--   2. projects.context->'target' — das Struktur-Feld "Ziel-KI" der Rail.
--      buildProjectContext ignoriert den Schluessel seit demselben Commit,
--      hier werden die Altwerte geloescht.
--   3. generations.outputs->'target' — die Kopie beim "Prompt speichern".
--
-- Beim Aufraeumen von projects bleibt updated_at stehen: der Trigger
-- projects_updated_at (0001) wuerde sonst jedes betroffene Projekt auf "jetzt
-- aktualisiert" setzen und die Sortierung der Projektliste verschieben, fuer
-- eine Aenderung, die der Nutzer nie gemacht hat. generations hat keinen
-- solchen Trigger.
--
-- Idempotent: jeder Schritt ist ein No-op, wenn er schon gelaufen ist.

alter table public.conversations drop column if exists target;

alter table public.projects disable trigger projects_updated_at;
update public.projects set context = context - 'target' where context ? 'target';
alter table public.projects enable trigger projects_updated_at;

update public.generations set outputs = outputs - 'target' where outputs ? 'target';
