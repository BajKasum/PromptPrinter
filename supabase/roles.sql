-- Läuft beim lokalen Start (supabase start) VOR den Migrationen und gleicht die
-- Standardrechte an die Produktion an (Betriebs-Audit, M1/M2, 05.10.2026).
--
-- Der Unterschied, gemessen gegen die Produktionsdatenbank: in Produktion
-- bekommen Objekte, die `postgres` im Schema public anlegt, KEINE automatischen
-- Rechte für anon und authenticated (pg_default_acl dort: Tabellen nur für
-- postgres und service_role). Genau deshalb gibt es 0002_grant_table_privileges
-- und den Satz "neue Tabellen mit Policy + Grant versehen". Der lokale Stack
-- vergibt dagegen von sich aus arwd an anon und authenticated.
--
-- Folge ohne diese Datei: ein vergessenes GRANT in einer Migration fiele lokal
-- nie auf (alles ist erlaubt, die RLS-Policy entscheidet allein) und führte in
-- Produktion zu "permission denied". Ein Smoketest gegen den lokalen Stack wäre
-- dann blind für genau die Fehlerklasse, die er fangen soll.
--
-- Die Rechte pro Tabelle, die die Migrationen ausdrücklich vergeben, bleiben
-- unberührt: hier wird nur der Standard für künftig angelegte Objekte entzogen.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
