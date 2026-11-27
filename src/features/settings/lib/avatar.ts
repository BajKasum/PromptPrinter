/**
 * Der eine Objektpfad im Bucket `avatars`, den ein Konto belegen kann.
 *
 * Profilbilder lassen sich nicht hochladen: der Bucket ist privat und hat keine
 * Schreibrechte für Konten (Migration 0048). Alte Objekte kann es noch geben,
 * deshalb entfernt das Löschen eines Kontos genau diesen Pfad
 * (`app/api/account/route.ts`).
 */
export function avatarStoragePath(userId: string): string {
  return `${userId}/avatar`;
}
