const GERMAN_MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** "17. Oktober 2026" → "2026-10-17"; `undefined`, wenn das Format nicht passt. */
export function isoFromGermanDate(text: string): string | undefined {
  const match = /^(\d{1,2})\. (\p{L}+) (\d{4})$/u.exec(text.trim());
  const month = match ? GERMAN_MONTHS.indexOf(match[2]) + 1 : 0;
  if (!match || month === 0) return undefined;
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}
