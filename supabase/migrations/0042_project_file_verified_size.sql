-- PromptPrinter — echte Storage-Größe statt der client-geschriebenen Spalte
-- Run AFTER 0041_subscription_portal_url.sql.
--
-- M-21 (Audit 06.09.2026): enforce_project_file_limit() (0022, zuletzt
-- geändert in 0038) prüfte die Pro-Datei- und Pro-Projekt-Grenzen gegen
-- new.size_bytes — eine Spalte, die der Client beim INSERT selbst mitgibt
-- (project-files.tsx: `size_bytes: file.size`), ohne dass irgendetwas sie je
-- gegen die tatsächlich hochgeladenen Bytes prüft. Der Upload-Ablauf lädt
-- erst per storage.upload() hoch (das echte Objekt landet dabei in
-- storage.objects, mit der wahren Größe in metadata->>'size'), und fügt DANACH
-- die project_files-Zeile ein — ein Client, der beim zweiten Schritt eine
-- kleinere Zahl angibt, unterläuft sowohl die Pro-Art-Grenze (200 KB Text /
-- 1 MB Lockfile) als auch das 25-MB-Projektbudget, bis hoch zum Bucket-eigenen
-- Limit von 2 MB pro Objekt (storage.buckets.file_size_limit, 0038) — 20
-- Dateien à 2 MB sind bis zu 40 MB statt der vorgesehenen 25.
--
-- Die Storage-API füllt storage.objects.metadata beim tatsächlichen Schreiben
-- der Bytes, der Client hat darauf keinen Einfluss (per Sichtprobe an der
-- Produktions-DB verifiziert: {"size": 10004, "contentLength": 10004, ...}).
-- Der Trigger liest die Größe jetzt von dort und schreibt sie auch in new.size_bytes
-- zurück, statt den Wert des Clients unverändert stehen zu lassen — sonst
-- bliebe die gespeicherte Zahl weiter falsch (UI, Budget-Summe künftiger
-- Inserts, brain-sources.ts), obwohl der Trigger selbst korrekt durchgesetzt
-- hätte. SECURITY INVOKER (unverändert): die Funktion läuft mit den Rechten
-- des Aufrufers, storage.objects' eigene RLS-Policy
-- (project_files_owner_select, 0012) lässt ohnehin nur die eigenen Objekte
-- sehen — referenziert ein Insert einen storage_path, der nicht existiert
-- oder nicht dem Aufrufer gehört, liefert die Abfrage keine Zeile, und der
-- Trigger lehnt ab, statt eine geratene Grösse zu akzeptieren.

create or replace function public.enforce_project_file_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  is_lockfile boolean;
  is_image boolean;
  max_bytes int;
  used_bytes bigint;
  real_bytes int;
begin
  -- Anzahl (war 10, siehe MAX_FILES_PER_PROJECT).
  if (select count(*) from public.project_files where project_id = new.project_id) >= 20 then
    raise exception 'Projekt-Dateilimit erreicht (20)';
  end if;

  -- Endungs-Allowlist, gespiegelt aus project-files.ts.
  if lower(new.name) !~ '\.(md|txt|json|csv|yaml|yml|toml|xml|ini|ts|tsx|js|jsx|mjs|cjs|css|scss|html|svg|sql|prisma|graphql|py|go|rb|rs|php|java|kt|swift|vue|svelte|astro|png|jpg|jpeg|webp|lock)$' then
    raise exception 'Dateityp nicht erlaubt';
  end if;

  -- Die tatsächlich geschriebenen Bytes, nicht was der Client behauptet
  -- (M-21). Keine Zeile hier heisst: kein passendes Objekt existiert oder
  -- gehört dem Aufrufer nicht (storage.objects' eigene RLS greift bereits).
  select (metadata->>'size')::int into real_bytes
  from storage.objects
  where bucket_id = 'project-files' and name = new.storage_path;

  if real_bytes is null then
    raise exception 'Datei wurde nicht gefunden';
  end if;
  new.size_bytes := real_bytes;

  -- Lockfiles zuerst: package-lock.json ist auch .json, pnpm-lock.yaml ist
  -- auch .yaml. Ohne diese Reihenfolge bekäme ein 800-KB-Lockfile die
  -- 200-KB-Textgrenze und würde abgelehnt (fileKind() macht es genauso).
  is_lockfile := lower(new.name) ~ '(^|/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|cargo\.lock|composer\.lock|gemfile\.lock|poetry\.lock|pubspec\.lock)$'
    or lower(new.name) ~ '\.lock$';
  is_image := lower(new.name) ~ '\.(png|jpg|jpeg|webp)$';

  max_bytes := case
    when is_lockfile then 1048576   -- MAX_LOCKFILE_BYTES, 1 MB
    when is_image then 2097152      -- MAX_IMAGE_BYTES, 2 MB
    else 204800                     -- MAX_TEXT_FILE_BYTES, 200 KB
  end;

  if new.size_bytes > max_bytes then
    raise exception 'Datei zu gross';
  end if;

  -- Summe pro Projekt (MAX_PROJECT_FILE_BYTES). Die eigentliche Schranke,
  -- seit einzelne Dateien 2 MB gross sein dürfen: ohne sie stünde pro Projekt
  -- 20 × 2 MB = 40 MB offen, mal der Projektzahl des Plans.
  select coalesce(sum(size_bytes), 0) into used_bytes
  from public.project_files where project_id = new.project_id;

  if used_bytes + new.size_bytes > 26214400 then
    raise exception 'Projekt-Speicherlimit erreicht';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_project_file_limit() from public, anon, authenticated;
