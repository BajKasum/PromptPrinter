// Die eine Prüfung, ob ein ganzer Text eine UUID ist, für jede Kennung von aussen (Adresse, Anfrage). Postgres lehnt
// alles andere mit einem Fehler ab, und ein Lesefehler wirft auf den Seiten (orThrow): eine vertippte Adresse soll 404
// sein, keine Fehlerseite. Wer UUIDs mitten in einem Text sucht (speed-insights-event.ts), braucht ein eigenes Muster.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}
