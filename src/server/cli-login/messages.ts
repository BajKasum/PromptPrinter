import "server-only";

// Die Sätze (`detail`) der Antworten von api/cli/*, die ein Terminal bekommt. Maschinennah und englisch,
// weil keine Seite sie anzeigt: das Terminal liest `kind` und schreibt seine eigenen Texte. Die Antworten
// an den Browser (Freigabe, api/cli/approve) stehen dagegen im Wörterbuch, in der Sprache des Nutzers.
export const CLI_PROBLEMS = {
  invalidCode: "The device code is unknown or was already used.",
  expired: "The device code expired. Start the login again.",
  denied: "The login was denied in the browser.",
  slowDown: "Polling too fast. Wait for the given interval.",
  sessionFailed: "The session could not be issued. Start the login again.",
  invalidToken: "The refresh token is not valid any more. Log in again.",
  unauthorized: "The access token is missing or not valid.",
  unavailable: "The service is not available right now. Try again later.",
} as const;
