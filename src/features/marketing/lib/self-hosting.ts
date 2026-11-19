// Die Befehle des Hilfe-Artikels "Selbst betreiben" (/docs/selbst-betreiben), die Kurzfassung von docs/SETUP.md,
// Abschnitt "Selbst betreiben". Jede Zeile hier steht dort wörtlich, self-hosting.test.ts vergleicht beide: ändert
// sich die Anleitung, fällt der Artikel auf, statt still einen alten Befehl zu zeigen.

/** Das freie Modell der Anleitung; Ollama hört danach auf http://localhost:11434. */
export const SELF_HOSTING_MODEL_COMMAND = "ollama pull qwen3";

/** Code holen, Abhängigkeiten installieren, die lokale Datenbank (Supabase-Stack) starten und ihre Schlüssel zeigen. */
export const SELF_HOSTING_SETUP_COMMANDS = [
  "git clone https://github.com/BajKasum/PromptPrinter.git",
  "cd PromptPrinter",
  "npm ci",
  "npx --yes supabase@2.119.0 start",
  "npx --yes supabase@2.119.0 status -o env",
] as const;

/** Die Vorlage kopieren. */
export const SELF_HOSTING_ENV_COPY = "cp .env.example .env.local";

/** Was in `.env.local` gehört; die übrigen Zeilen der Vorlage bleiben leer. */
export const SELF_HOSTING_ENV_LINES = [
  "SELF_HOSTED=1",
  "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY aus supabase status>",
  "SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY aus supabase status>",
  "NEXT_PUBLIC_APP_URL=http://localhost:3000",
  `API_KEY_ENCRYPTION_SECRET=<Ausgabe von: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">`,
  "LLM_BASE_URL=http://localhost:11434/v1",
  "LLM_MODEL=qwen3",
] as const;

/** Starten, in der Entwicklung mit Hot-Reload. */
export const SELF_HOSTING_START_COMMAND = "npm run dev";

/** Die Adresse der App nach dem Start. */
export const SELF_HOSTING_APP_URL = "http://localhost:3000";
