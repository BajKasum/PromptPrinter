-- PromptPrinter — Abo-Zustand aus Lemon Squeezy festhalten
-- Run AFTER 0038_project_file_sources.sql.
--
-- Vorgeschichte: seit 575dec8 kann man Pro kaufen, aber die Freischaltung lief
-- von Hand — es gab keinen Ort, an dem der Zustand eines Abos gestanden hätte.
-- Diese Migration legt ihn an, der Webhook (/api/webhooks/lemonsqueezy) füllt
-- ihn.
--
-- ─── Warum Spalten auf profiles und keine eigene subscriptions-Tabelle ─────
-- Ein Konto hat genau ein Abo (ein Produkt, ein Preis). `plan` steht schon hier
-- und wird auf JEDER authentifizierten Seite mitgelesen; der Abo-Zustand gehört
-- dorthin, wo die Entscheidung fällt, die er begründet. Eine eigene Tabelle
-- würde jeder Plan-Prüfung einen Join oder eine zweite Abfrage aufhalsen, für
-- eine 1:1-Beziehung. Die Historie steckt statt dessen in billing_events unten,
-- wo sie hingehört.
--
-- ─── Warum kein CHECK auf subscription_status ─────────────────────────────
-- `plan` hat einen (0001), und das ist richtig: das sind UNSERE Werte. Der
-- Abo-Status kommt dagegen von Lemon Squeezy (on_trial, active, paused,
-- past_due, unpaid, cancelled, expired). Führte ein CHECK diese Liste, würde
-- ein künftiger neuer Status den Webhook mit einem Constraint-Fehler
-- abbrechen lassen — ausgerechnet an der Stelle, die den Zahlungszustand
-- nachführen soll. Begrenzt wird deshalb die Länge, nicht die Bedeutung
-- (dieselbe Linie wie 0034).

alter table public.profiles
  add column if not exists subscription_id text,
  add column if not exists subscription_customer_id text,
  add column if not exists subscription_status text,
  add column if not exists subscription_renews_at timestamptz,
  add column if not exists subscription_ends_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_subscription_ids_len'
  ) then
    alter table public.profiles
      add constraint profiles_subscription_ids_len check (
        char_length(subscription_id) <= 100
        and char_length(subscription_customer_id) <= 100
        and char_length(subscription_status) <= 50
      );
  end if;
end $$;

-- Der zweite Weg, ein Ereignis einem Konto zuzuordnen, wenn custom_data fehlt
-- (Abo-Ereignisse tragen die Kundennummer immer, die Konto-ID nicht immer).
-- Partiell, weil die Spalte für alle Nicht-Zahler NULL ist und ein Index über
-- lauter NULLs nur Platz kostet.
create index if not exists profiles_subscription_customer_idx
  on public.profiles (subscription_customer_id)
  where subscription_customer_id is not null;

-- Lesen ja, schreiben nein. Die Abrechnungsseite zeigt Status und Verlängerung
-- an, geschrieben wird ausschliesslich im Webhook über den Service-Role-Client.
-- Ein UPDATE-Grant hier hiesse: jeder angemeldete Nutzer setzt sich sein Abo
-- aus der Browser-Konsole auf "active". Die Spalten stehen deshalb bewusst
-- NICHT in dem Grant aus 0014/0020, der display_name, avatar_url und settings
-- schreibbar macht.
grant select (
  subscription_id,
  subscription_customer_id,
  subscription_status,
  subscription_renews_at,
  subscription_ends_at
) on public.profiles to authenticated;

-- ─── Ereignis-Protokoll, zugleich der Doppel-Schutz ───────────────────────
-- Lemon Squeezy stellt bei jedem Nicht-2xx erneut zu, und auch ein
-- erfolgreiches Ereignis kann doppelt ankommen. `event_key` ist der Fingerprint
-- des rohen Rumpfs: eine Wiederholung derselben Zustellung hat denselben,
-- eine echte spätere Änderung (anderes updated_at) einen anderen. Der Unique-
-- Index ist damit die eigentliche Sperre, nicht die Prüfung im Code — zwei
-- gleichzeitige Zustellungen können sich nicht beide durchschmuggeln.
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_key text not null unique,
  resource_id text,
  -- Bleibt als Beleg stehen, wenn das Konto gelöscht wird: die Zeile trägt
  -- keine Personendaten, nur die Kennungen des Zahlungsanbieters.
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'ignored', 'failed')),
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_events_text_len check (
    char_length(event_name) <= 100
    and char_length(event_key) <= 100
    and char_length(resource_id) <= 100
    and char_length(detail) <= 500
  )
);

alter table public.billing_events enable row level security;

-- Bewusst OHNE Policy: RLS an und keine einzige Policy heisst, dass anon und
-- authenticated nichts sehen. Das ist keine Lücke, sondern die Absicht — das
-- hier sind Betriebsdaten, kein Nutzerinhalt. Der Service-Role-Client umgeht
-- RLS ohnehin, aber die Rechte werden trotzdem ausdrücklich vergeben statt
-- den Supabase-Standardrechten überlassen: ein Grant, den man liest, ist
-- besser als einer, den man annimmt.
revoke all on public.billing_events from anon, authenticated;
grant select, insert, update on public.billing_events to service_role;

-- Für den Aufräum-Blick des Betreibers: "was ist zuletzt schiefgegangen".
create index if not exists billing_events_status_created_idx
  on public.billing_events (status, created_at desc);

drop trigger if exists billing_events_set_updated_at on public.billing_events;
create trigger billing_events_set_updated_at
  before update on public.billing_events
  for each row execute function public.set_updated_at();
