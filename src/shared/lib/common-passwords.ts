// Sehr häufig verwendete Passwörter, für die lokale Prüfung in password.ts.
//
// ─── Was das ist, und was nicht ────────────────────────────────────────────
// Kein Ersatz für die Prüfung gegen geleakte Passwörter (HaveIBeenPwned), die
// Supabase als "Leaked Password Protection" anbietet. Dieser Schalter gehört
// zu einem bezahlten Supabase-Tarif; das Projekt läuft auf Free, also ist er
// aus (Supabase-Advisor: auth_leaked_password_protection). Die Alternative,
// HaveIBeenPwned selbst abzufragen, hätte einen Drittdienst in den
// Anmeldeweg gehängt, der in der Datenschutzerklärung stehen müsste. Diese
// Liste ist die Lösung ohne Drittdienst: sie fängt die offensichtlichsten
// Fälle, ohne dass ein Passwort oder ein Hash das Haus verlässt.
//
// Sie ist KLEIN und bleibt es. Eine lange Liste im Client-Bundle kostet jeden
// Besucher Bytes für eine Seite, die er selten braucht, und gewänne wenig: die
// Treffer, die zählen, sind die Muster (Wort plus Ziffern, Tastaturreihen), nicht
// das n-te seltene Passwort. Wer eine echte Abdeckung will, schaltet den
// Supabase-Schalter ein.
//
// Zwei Listen, aus zwei Gründen:
//
// 1. COMMON_PASSWORDS: ganze Werte, die für sich schon gebräuchlich sind und
//    sich nicht als "Wort plus Anhang" beschreiben lassen (Zahlenreihen,
//    Tastaturwege). Nur Werte ab MIN_PASSWORD_LENGTH: alles Kürzere weist die
//    Längenregel ohnehin ab, ein Eintrag wäre toter Text.
// 2. COMMON_BASE_WORDS: Wörter, die als Kern eines Passworts gelten. password.ts
//    nimmt Ziffern und Zeichen an den Rändern weg und löst Leetspeak auf
//    (p@ssw0rd → password), bevor es hier nachsieht. So fällt "Password2024!"
//    mit demselben Eintrag wie "password1". Nur Buchstaben a-z, kleingeschrieben.
//
// Beide Formen werden in password.test.ts geprüft (kleingeschrieben, nur
// erlaubte Zeichen, keine toten Einträge).

export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  // Zahlenreihen
  "1234567890",
  "0123456789",
  "9876543210",
  "0987654321",
  "12345678901",
  "123456789012",
  "1234567890123",
  "1234567891",
  "12345678910",
  "1234554321",
  "1122334455",
  "112233445566",
  "1111111111",
  "2222222222",
  "0000000000",
  "1212121212",
  "1231231231",
  "123123123123",
  "123456123456",
  "1357924680",
  "0246813579",
  // Tastaturwege
  "qwertyuiop",
  "qwertzuiop",
  "asdfghjkl1",
  "zxcvbnm123",
  "qwerty1234",
  "qwerty12345",
  "qwerty123456",
  "qwertyuiop123",
  "qwertyuiopasdfghjkl",
  "qazwsxedcrfv",
  "1qaz2wsx3edc",
  "1qazxsw23edc",
  "zaq12wsxcde3",
  "1q2w3e4r5t",
  "1q2w3e4r5t6y",
  "q1w2e3r4t5",
  "q1w2e3r4t5y6",
  "asdfasdfasdf",
  "qweasdzxc123",
  // Gebräuchliche Wendungen, die kein Basiswort plus Anhang sind
  "iloveyou123",
  "ichliebedich",
  "letmein123",
  "trustno1234",
  "changeme123",
  "abcd123456",
  "abc1234567",
  "a1b2c3d4e5",
  "123456abcd",
  "1234abcd5678",
  "adminadmin",
  "passwordpassword",
  "passwortpasswort",
]);

export const COMMON_BASE_WORDS: ReadonlySet<string> = new Set([
  // Das Offensichtliche
  "password",
  "passwort",
  "passwd",
  "pass",
  "secret",
  "geheim",
  "changeme",
  "default",
  "admin",
  "administrator",
  "root",
  "login",
  "user",
  "guest",
  "test",
  "testing",
  "demo",
  // Tastatur
  "qwerty",
  "qwertz",
  "qwertyuiop",
  "qwertzuiop",
  "asdfgh",
  "asdfghjkl",
  "zxcvbn",
  "zxcvbnm",
  "abcdef",
  "abcdefg",
  "abcdefgh",
  "abcdefghij",
  // Begrüssung und Gefühl
  "welcome",
  "willkommen",
  "hello",
  "hallo",
  "iloveyou",
  "letmein",
  "trustno",
  "whatever",
  "freedom",
  "liebe",
  "schatz",
  // Immer wieder gewählte Wörter und Namen
  "master",
  "dragon",
  "monkey",
  "shadow",
  "sunshine",
  "sonnenschein",
  "princess",
  "mustang",
  "flower",
  "butterfly",
  "cheese",
  "summer",
  "winter",
  "sommer",
  "football",
  "fussball",
  "baseball",
  "basketball",
  "soccer",
  "superman",
  "batman",
  "spiderman",
  "starwars",
  "pokemon",
  "computer",
  "internet",
  "access",
  "michael",
  "jordan",
  "charlie",
  "jessica",
  "jennifer",
  "ashley",
  "daniel",
  "thomas",
  // Der Dienst selbst: wer sein Passwort nach der Seite benennt, wird zuerst erraten
  "promptprinter",
  "prompt",
  "printer",
]);
