-- PromptPrinter — Projektdateien als Analysequellen (Project Brain)
-- Run AFTER 0037_project_brains.sql.
--
-- 0012/0022/0029 haben die Dateien eines Projekts auf „ein paar Notizen"
-- zugeschnitten: .md/.txt/.json/.csv, 10 Stück à 200 KB. Das Projekt-
-- Gedächtnis analysiert dagegen das, woraus ein Projekt tatsächlich besteht —
-- package.json, Lockfile, tsconfig, next.config, Migrationen, Screenshots.
-- Diese Migration zieht die drei Stellen nach, an denen die alten Grenzen
-- serverseitig hängen (Trigger, Storage-Policy, Bucket-Limit), und hält sie
-- deckungsgleich mit src/features/projects/lib/project-files.ts.
--
-- WARUM PRO ART UND NICHT EINE ZAHL: ein Lockfile liegt regelmässig bei
-- mehreren hundert KB, ein Screenshot bei ein bis zwei MB, eine
-- Konfigurationsdatei bei wenigen KB. Eine gemeinsame Obergrenze wäre
-- entweder zu klein für Bilder oder unnötig grosszügig für Textdateien. Die
-- Schranke, die den Speicherverbrauch wirklich bindet, ist deshalb nicht die
-- pro Datei, sondern die neue Summe pro Projekt (25 MB) weiter unten.

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
begin
  -- Anzahl (war 10, siehe MAX_FILES_PER_PROJECT).
  if (select count(*) from public.project_files where project_id = new.project_id) >= 20 then
    raise exception 'Projekt-Dateilimit erreicht (20)';
  end if;

  -- Endungs-Allowlist, gespiegelt aus project-files.ts.
  if lower(new.name) !~ '\.(md|txt|json|csv|yaml|yml|toml|xml|ini|ts|tsx|js|jsx|mjs|cjs|css|scss|html|svg|sql|prisma|graphql|py|go|rb|rs|php|java|kt|swift|vue|svelte|astro|png|jpg|jpeg|webp|lock)$' then
    raise exception 'Dateityp nicht erlaubt';
  end if;

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

-- ─── Storage: Bucket-Grösse und Objektzahl ─────────────────────────────────
-- Das Bucket-Limit ist eine einzige Zahl für alle Objekte, also muss es die
-- grösste erlaubte Einzeldatei tragen (2 MB, Bilder). Die feinere Staffelung
-- pro Art macht der Trigger oben; ohne passende Zeile in project_files ist
-- ein hochgeladenes Objekt ohnehin nur totes Gewicht, das die Zählschranke
-- der Policy weiter unten mitbegrenzt.
update storage.buckets set file_size_limit = 2097152 where id = 'project-files';

-- Identisch zu 0029, nur mit der neuen Obergrenze (war 10). Der Rest der
-- Policy bleibt Wort für Wort stehen, inklusive der dort dokumentierten
-- Qualifizierung von objects.name — `name` unqualifiziert bindet in den
-- Subqueries an die falsche Tabelle (projects.name ist der Projekttitel).
drop policy if exists project_files_owner_insert on storage.objects;
create policy project_files_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'project-files'
    and (storage.foldername(objects.name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.projects p
      where p.id::text = (storage.foldername(objects.name))[2]
        and p.user_id = (select auth.uid())
    )
    and (
      select count(*)
      from storage.objects o
      where o.bucket_id = 'project-files'
        and o.name like (select auth.uid())::text || '/' || (storage.foldername(objects.name))[2] || '/%'
    ) < 20
  );
