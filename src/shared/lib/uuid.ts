// Kennungen aus der Adresse (Chat, Projekt) sind UUIDs. Postgres lehnt alles andere mit einem Fehler ab, und ein
// Lesefehler wirft auf den Seiten (orThrow): eine vertippte Adresse soll 404 sein, keine Fehlerseite.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}
