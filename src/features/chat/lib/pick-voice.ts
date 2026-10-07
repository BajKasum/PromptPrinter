// Die Stimme der Sprachausgabe, ausgelagert aus voice-bar.tsx (Betriebs-Audit, Folgesitzung
// 2026-10-07, Dateigroesse): reine Funktion, deshalb einzeln pruefbar.

/**
 * Picks a voice in the app's language if the platform has one (preferring an
 * on-device one), else whatever is default. `lang` is a BCP-47 tag like
 * "de-DE"; only its language part has to match.
 */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const prefix = lang.slice(0, 2).toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix) && v.localService) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
    null
  );
}
