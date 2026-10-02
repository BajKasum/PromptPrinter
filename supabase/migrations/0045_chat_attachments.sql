-- PromptPrinter — Fotos und Dateien an Chat-Nachrichten
-- Run AFTER 0044_drop_conversation_target.sql, and BEFORE the code that writes
-- message_attachments is deployed: that code inserts into this table on every
-- turn that carries an attachment and would fail against a missing one. Anders
-- als bei 0044 ist die Reihenfolge hier umgekehrt: die Migration ist rein
-- additiv, der alte Code kennt die Tabelle nicht und stört sich nicht an ihr.
--
-- Im Chat gibt es einen "+"-Knopf (Fotos oder Dateien hinzufügen). Ein Anhang
-- besteht aus zwei Teilen, die nur zusammen etwas sind:
--
--   1. das Objekt im privaten Bucket `chat-attachments` (die Bytes),
--   2. eine Zeile in `message_attachments` (wem es gehört, an welcher
--      Nachricht es hängt, wie es heisst).
--
-- WARUM ZWEI TEILE UND NICHT NUR EINER: die Bytes gehören nicht in die
-- Datenbank. Das Supabase-Projekt hat 500 MB Datenbank, aber 1 GB Storage,
-- und ein Screenshot liegt bei einigen hundert KB. Die Zeile ist die
-- Verbindung zur Nachricht, über sie kaskadiert das Löschen (Chat, Projekt,
-- Konto) und über sie sieht die Oberfläche, was an einer Nachricht hängt.
--
-- WARUM DER BUCKET KEINE INSERT-POLICY HAT: hochgeladen wird ausschliesslich
-- in /api/chat, über den Service-Role-Client, nachdem die Route Magic Bytes,
-- Textkodierung, Grössen und das Speicherkontingent des Kontos geprüft hat.
-- Mit einer insert-Policy für `authenticated` könnte ein Nutzer aus der
-- Browser-Konsole beliebig viele Objekte in seinen eigenen Ordner legen, an
-- keiner Nachricht, an keiner Prüfung vorbei. 0029 ist genau diesem Loch beim
-- Projekt-Bucket nachträglich hinterhergelaufen; hier entsteht es gar nicht
-- erst. Dieselbe Linie wie bei project_brains (0037): was nur die Route
-- schreiben darf, bekommt keinen Schreib-Grant für den Client.
--
-- WAS DER CLIENT DARF: lesen (die Vorschau braucht eine signierte Adresse, die
-- der Server mit dem Nutzer-JWT erzeugt, also select) und löschen (der
-- Aufräum-Weg beim Löschen eines Chats oder Projekts läuft im Browser, wie bei
-- project-files, siehe delete-project.tsx). Gelöscht wird nie ein Objekt ohne
-- Zeile: erst die Zeile (über das Löschen des Chats), dann das Objekt.
--
-- Storage-Objekte kaskadieren NICHT mit der Zeile. Bleibt ein Objekt zurück
-- (Netzwerkfehler beim Aufräumen), kostet es Platz und sonst nichts, es wird
-- nie ausgeliefert. scripts/reconcile-chat-attachments-storage.mjs findet
-- solche Waisen.

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Redundant zu message_id, mit Absicht: das Aufräumen beim Löschen eines
  -- Chats oder Projekts fragt "alle Anhänge dieser Konversation(en)", und das
  -- soll ohne Umweg über messages gehen.
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 255),
  kind text not null check (kind in ('image', 'text')),
  -- Genau die vier Typen, die die Route ablegt. Textdateien werden immer als
  -- text/plain gespeichert, nie mit dem Typ, den der Browser behauptet: ein
  -- hochgeladenes .html wird so nie als HTML ausgeliefert.
  media_type text not null
    check (media_type in ('image/png', 'image/jpeg', 'image/webp', 'text/plain')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 2097152),
  storage_path text not null unique check (char_length(storage_path) <= 400),
  created_at timestamptz not null default now(),
  constraint message_attachments_kind_matches_media
    check ((kind = 'image') = (media_type like 'image/%'))
);

-- Die Chat-Seite lädt die Anhänge pro Nachricht, das Aufräumen pro Chat, die
-- Kontingentprüfung und das Löschen des Kontos pro Nutzer.
create index if not exists message_attachments_message_idx
  on public.message_attachments(message_id);
create index if not exists message_attachments_conversation_idx
  on public.message_attachments(conversation_id);
create index if not exists message_attachments_user_idx
  on public.message_attachments(user_id);

-- ─── Höchstens vier Anhänge je Nachricht ───────────────────────────────────
-- Dieselbe Zahl wie MAX_ATTACHMENTS_PER_MESSAGE (chat-limits.ts), von keiner
-- Migration importierbar, also zweimal vorhanden. Geschrieben wird nur vom
-- Server, der die Grenze ohnehin prüft: das hier ist die Schranke für den Tag,
-- an dem jemand anders schreibt, in der Form wie 0022 sie für project_files
-- gesetzt hat.
create or replace function public.enforce_message_attachment_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select count(*) from public.message_attachments where message_id = new.message_id) >= 4 then
    raise exception 'Anhang-Limit je Nachricht erreicht (4)';
  end if;
  return new;
end;
$$;

drop trigger if exists message_attachments_limit on public.message_attachments;
create trigger message_attachments_limit before insert on public.message_attachments
  for each row execute function public.enforce_message_attachment_limit();

-- Läuft nur aus dem Trigger, muss nie per RPC aufrufbar sein (wie 0003/0022).
revoke execute on function public.enforce_message_attachment_limit()
  from public, anon, authenticated;

-- ─── Belegter Anhang-Speicher des angemeldeten Kontos ──────────────────────
-- Die Route prüft vor jedem Upload, ob das Konto noch Platz hat
-- (MAX_ATTACHMENT_STORAGE_PER_USER, chat-limits.ts). Als Funktion und nicht
-- als `select size_bytes ... ` im Client-Code: PostgREST kappt eine Antwort
-- bei max-rows (Standard 1000), und ein Konto mit vielen kleinen Textdateien
-- läge dann unbemerkt unter seiner echten Summe.
--
-- security invoker: läuft als der angemeldete Nutzer, die RLS-Policy unten
-- begrenzt die Summe also von selbst auf eigene Zeilen. Der explizite
-- user_id-Vergleich ist die übliche zweite Linie (CLAUDE.md, Defense in depth).
create or replace function public.attachment_bytes_used()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(size_bytes), 0)::bigint
  from public.message_attachments
  where user_id = (select auth.uid())
$$;

-- Nur für angemeldete Nutzer aufrufbar, nicht für anon (wie 0032).
revoke execute on function public.attachment_bytes_used() from public, anon;
grant execute on function public.attachment_bytes_used() to authenticated;

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.message_attachments enable row level security;

-- `(select auth.uid())` statt `auth.uid()`: Hausstandard seit 0035. Gilt für
-- Tabellen im public-Schema, nicht für storage.objects (siehe 0036).
drop policy if exists message_attachments_owner_select on public.message_attachments;
create policy message_attachments_owner_select on public.message_attachments
  for select using ((select auth.uid()) = user_id);

-- Bewusst NUR select. Insert und Delete gibt es ausschliesslich über den
-- Service-Role-Client der Route (Insert) und über die Kaskade vom Löschen der
-- Nachricht, Konversation oder des Kontos (Delete). Referentielle Aktionen
-- laufen ohne RLS, ein delete-Grant ist dafür nicht nötig.
grant select on public.message_attachments to authenticated;

-- ─── chat-attachments storage bucket ───────────────────────────────────────
-- Privat. Die Oberfläche bekommt nur kurzlebige signierte Adressen. 2 MB
-- Objektgrenze (grösstes erlaubtes Bild: 1 MB, grösste Textdatei: 200 KB, der
-- Spielraum ist der Wert aus message_attachments.size_bytes). Die erlaubten
-- MIME-Typen sind hier verlässlich, anders als bei project-files (0012): der
-- Server setzt den Typ selbst, der Browser hat dabei kein Wort mehr.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'text/plain']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Pfad: {userId}/{conversationId}/{attachmentId}.{ext}. Der erste Abschnitt
-- ist der Eigentümer, genau wie bei project-files.
--
-- Bares `auth.uid()`, NICHT `(select auth.uid())`: 0036 beschreibt, warum der
-- InitPlan-Umbau auf storage.objects Uploads zerbrochen hat. Diese beiden
-- Policies lesen storage.objects nicht selbst und wären davon nicht betroffen,
-- aber ein Schema, in dem jede storage-Policy gleich aussieht, ist das, was
-- der nächste Leser nicht "korrigieren" will.
drop policy if exists chat_attachments_owner_select on storage.objects;
create policy chat_attachments_owner_select on storage.objects
  for select using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists chat_attachments_owner_delete on storage.objects;
create policy chat_attachments_owner_delete on storage.objects
  for delete using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Keine insert-Policy, siehe oben. Der Service-Role-Client umgeht RLS.
