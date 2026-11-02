# Setup, Betrieb und Aufbau

Für den Betreiber des Projekts. Die [Lizenz](../LICENSE) erlaubt anderen nur das
Ansehen des Codes, nicht das Ausführen. Was PromptPrinter ist und kann, steht
im [README](../README.md).

## Tech-Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** (strict)
- **Supabase**, Auth, Postgres, Row-Level-Security
- **Lemon Squeezy**, Billing (Checkout + Webhook live)
- **Z.ai (GLM)** als Standard-Modell, Gemini als Zweit-Provider, dazu eigene
  Keys der Nutzer (Anthropic, OpenAI, Gemini, OpenAI-kompatible Endpunkte);
  ohne Key läuft der Stub-Modus
- **Upstash Redis**, Rate-Limiting · **Vercel**, Hosting
- **Tailwind** mit HSL-Token-System · **Framer Motion** · **next-themes**
- **Vitest** für Unit-Tests · **Docker** für Dev (Hot-Reload) und Prod (standalone)

## Schnellstart

```bash
# 1. Abhängigkeiten
npm install

# 2. Env anlegen (siehe „Environment" unten)
cp .env.example .env.local
#   → NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY und SUPABASE_SERVICE_ROLE_KEY eintragen

# 3. Datenbank-Migrationen einspielen
#    Supabase SQL-Editor oder CLI, ALLE Dateien in supabase/migrations/ der
#    Reihe nach, von 0001 aufwärts (kein Endpunkt hier genannt, der sonst bei
#    jeder neuen Migration erneut veraltet, M-23 im Audit vom 06.09.2026).

# 4. Dev-Server
npm run dev          # http://localhost:3000
```

Ohne `ZAI_API_KEY` (bzw. `GEMINI_API_KEY` als Zweit-Provider) antwortet
`/api/chat` im **Stub-Modus** (eine Demo-Antwort), der Flow bleibt testbar, ohne
API-Quota zu verbrauchen. Der Modellzugriff ist in
[`src/server/llm/`](../src/server/llm/index.ts) gekapselt (Z.ai primär, Gemini
sekundär).

Die Gedächtnis-Analyse hat bewusst **keinen** Stub: eine erfundene Faktenliste
wäre schlimmer als gar keine, weil sie danach in jeden Prompt dieses Projekts
wandert. Ohne Provider-Key sagt sie ab, auch lokal.

## Scripts

| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server mit Hot-Reload |
| `npm run build` | Production-Build (standalone) |
| `npm run start` | Gebauten Build starten |
| `npm run lint` | ESLint-CLI (`eslint . --max-warnings 0`, jede Warnung stoppt das Gate) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (Unit-Tests) |
| `npm run test:coverage` | Dieselben Tests mit Messung der Abdeckung (V8), schreibt `coverage/` und eine Tabelle je Verzeichnis (siehe „Testabdeckung") |
| `npm run test:e2e` | Playwright-Smoketests im Browser gegen einen lokalen Supabase-Stack (siehe „Ende-zu-Ende-Tests", braucht Docker) |
| `npm run test:e2e:prod` | Dieselbe Technik gegen den Produktionsaufbau (`next build`, `next start`), siehe „Browser-Test gegen den Produktionsaufbau" |
| `node scripts/take-screenshots.mjs` | Screenshots aller Seiten in Light+Dark → `screenshots_Docs/` (braucht laufenden Dev-Server, Chrome und `SCREENSHOT_EMAIL`/`SCREENSHOT_PASSWORD` in `.env.local`) |

## Environment

Vorlage: [`.env.example`](../.env.example). Welche Datei wo gelesen wird:

| Datei | Wird gelesen von |
|---|---|
| `.env.local` | `npm run dev`, Dev-Docker (`docker-compose.yml`), Screenshot-Script |
| `.env` | Prod-Docker (`docker-compose.prod.yml`, via `env_file`) |
| `.env.example` | nur Vorlage (committed) |

**Regel:** Secrets niemals mit `NEXT_PUBLIC_*` prefixen, die landen sonst im
Client-Bundle. Server-seitige Keys (`SUPABASE_SERVICE_ROLE_KEY`, `ZAI_API_KEY`,
`LEMON_SQUEEZY_WEBHOOK_SECRET`) bleiben ohne Prefix.

### Deploy-Checkliste

Diese sieben Variablen sind in Produktion **Pflicht**, nicht optional. Fehlt eine,
bricht der Start mit einer Meldung ab, die sie benennt (`src/server/env.ts`, geprüft
beim Boot über `src/instrumentation.ts`):

| Variable | Warum sie load-bearing ist |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Ohne Supabase keine Anmeldung, keine Daten |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dito |
| `SUPABASE_SERVICE_ROLE_KEY` | Kontolöschung (`/api/account`) braucht Admin-Rechte |
| `NEXT_PUBLIC_APP_URL` | Sonst verlinken Bestätigungs- und Reset-Mails auf `localhost:3000` |
| `API_KEY_ENCRYPTION_SECRET` | BYOK wirft beim Speichern eines eigenen Keys |
| `UPSTASH_REDIS_REST_URL` | **Ohne Upstash antworten ALLE API-Routen mit 429** |
| `UPSTASH_REDIS_REST_TOKEN` | dito |

Der Upstash-Punkt ist der unangenehmste: `src/server/security/rate-limit.ts` scheitert in
Produktion bewusst geschlossen, statt auf einen Limiter zurückzufallen, der über
mehrere Instanzen hinweg gar nichts mehr begrenzt. Der resultierende 429 sieht
nach Rate-Limit aus, nicht nach fehlender Konfiguration — deshalb der
Start-Abbruch statt einer stillen Fehlfunktion.

Ohne `ZAI_API_KEY`/`GEMINI_API_KEY` startet die App, warnt aber: der Chat läuft
dann im Stub-Modus und liefert eine Demo-Antwort statt einer echten.

Optional, aber für die Suche nützlich: `GOOGLE_SITE_VERIFICATION` und
`BING_SITE_VERIFICATION` (Inhaber-Nachweis für Search Console und Bing, siehe
`.env.example`).

### BYOK-Secret rotieren

`API_KEY_ENCRYPTION_SECRET` verschlüsselt die Keys, die Nutzer in den
Einstellungen hinterlegen. Bis zum 04.10.2026 hing jeder Key an genau diesem
einen Wert: wer ihn änderte, machte alle Keys unlesbar, und `getUserOverride()`
stuft einen unlesbaren Key stillschweigend auf "kein eigener Key" zurück. Jeder
BYOK-Nutzer lief dann unbemerkt auf dem Server-Key und unter den Plan-Grenzen.
Eine Rotation geht jetzt so:

1. Neues Secret erzeugen (lang, zufällig).
2. In Vercel `API_KEY_ENCRYPTION_SECRET_PREVIOUS` = altes Secret,
   `API_KEY_ENCRYPTION_SECRET` = neues Secret. Deployen. Die App liest ab jetzt
   Keys unter beiden Secrets und schreibt nur noch unter dem neuen. Beim Start
   erscheint eine Warnung, solange die Rotation offen ist.
3. `scripts/rotate-byok-secret.mjs` im Probelauf (ohne `--apply`): zählt, wie
   viele Zeilen noch nur das alte Secret öffnet. Schreibt nichts.
4. Dasselbe mit `--apply`: schlüsselt diese Zeilen unter dem neuen Secret neu.
   Es schreibt nur, solange noch der alte Chiffretext in der Zeile steht (hat
   ein Nutzer zwischendurch neu gespeichert, gewinnt sein Wert), und gibt nie
   einen Key oder ein Secret aus.
5. Probelauf noch einmal: "nur altes Secret: 0".
6. `API_KEY_ENCRYPTION_SECRET_PREVIOUS` in Vercel löschen, deployen. **Erst jetzt
   ist das alte Secret wirklich ungültig**, solange die Variable steht, öffnet
   es alles, was noch nicht umgeschlüsselt ist.

Zeilen, die weder das alte noch das neue Secret öffnet, meldet das Skript mit
Exit 3 und Zeilen-ID. Es löscht nie etwas; der Nutzer muss den Key neu eingeben.
Das Skript liest die Werte bewusst nur aus der Umgebung, nie aus einer
`.env`-Datei (Aufruf im Kopfkommentar), damit eine Rotation nicht versehentlich
gegen die falsche Datenbank läuft.

## Docker

Siehe [`DOCKER.md`](DOCKER.md), Dev (Hot-Reload, Port 3000) und Prod (standalone,
Port 3001) als jeweils ein Befehl.

## Design

Siehe [`DESIGN.md`](DESIGN.md), Token-System, Theme-Regeln, Komponenten-Status.

## Qualität

Vor jedem Commit muss das volle Gate grün sein:

```bash
npm run audit:gate && npm run typecheck && npm run lint && npm run test && npm run build
```

[CI](../.github/workflows/ci.yml) führt genau dieselbe Kette bei jedem Pull Request (Stand nach dem
Merge in `main`) und bei jedem Push auf `main` aus, ein Lauf je Commit (#222).
Ein Branch ohne PR hat keinen Lauf; von Hand: Actions, "CI", "Run workflow". Die Smoketests laufen getrennt in
[`e2e.yml`](../.github/workflows/e2e.yml) (nur wenn etwas Betroffenes geändert wird,
dazu wöchentlich), `docker.yml` hält den Docker-Pfad am Leben, und `audit.yml`
prüft täglich die Abhängigkeiten (siehe "Täglicher Audit" unten). `audit:gate` ist
`npm audit --audit-level=high`, nach Baum getrennt (`scripts/audit-gate.mjs`): ein Fund
im ausgelieferten Baum blockiert immer, einer nur in einem Entwicklungswerkzeug nur dann, wenn es
eine gepatchte Version gibt. Es gibt keine Ausnahmeliste.

### Abhängigkeiten (Dependabot)

[`.github/dependabot.yml`](../.github/dependabot.yml) schlägt montags um 5 Uhr
(Zürich) Updates für npm und GitHub Actions vor: Minor und Patch zusammen in
**einem** PR je Ökosystem, jeder Major einzeln, höchstens 5 (npm) bzw. 3
(Actions) offene PRs. Es gibt **keinen Auto-Merge**: jeder Dependabot-PR läuft
durch dieselbe CI wie jeder andere (CI, bei Änderung an `package*.json` auch
E2E, dazu eine Vercel-Vorschau) und wartet auf eine Entscheidung. Keiner dieser
Läufe braucht ein Repository-Secret.

Zwei Versionen sieht Dependabot **nicht**:

- **Supabase-CLI** (`2.119.0`): `version:` in `e2e.yml`, dieselbe Zahl in dieser
  Datei und in `e2e/support/env.ts`. Anheben heißt an allen Stellen.
  `tests/guards/pinned-versions.test.ts` scheitert, wenn sie auseinanderlaufen.
- **Playwright-Browser**: folgt dem Lockfile (Cache-Schlüssel in `e2e.yml`), also
  dem npm-Eintrag von `@playwright/test`.

**Einmalig in den Repository-Einstellungen** (kein Code, nur ein Klick): unter
*Settings → Code security* "Dependabot security updates" einschalten. Dann
öffnet GitHub auch außerhalb des Montags einen PR, sobald ein Advisory eine
Abhängigkeit trifft. Stand 06.10.2026: ausgeschaltet.

### Täglicher Audit

`npm audit` lief nur bei Pushes, ein neues Advisory färbte deshalb den nächsten,
unbeteiligten Push rot (23.09., 01.10., 06.10.2026). Der Workflow
[`audit.yml`](../.github/workflows/audit.yml) führt täglich um 4:37 UTC auf `main`
dasselbe Gate aus wie die CI (`node scripts/audit-gate.mjs`) und findet ein neues
Advisory am selben Tag. Ein geplanter Lauf färbt keinen Commit, deshalb meldet
[`scripts/audit-issue.mjs`](../scripts/audit-issue.mjs) das Ergebnis als
**GitHub-Issue** (Label `audit`, Titel "Audit: Abhängigkeiten brauchen eine
Entscheidung"):

- Audit gescheitert (ein blockierender Fund, Registry nicht erreichbar, oder der
  Lauf kam gar nicht bis zum Audit): Issue wird **einmal angelegt**, jeder weitere
  Fehlschlag ergänzt es um einen Kommentar.
- Wieder sauber: das Issue wird mit einem Kommentar geschlossen.

Ein Fund **nur in einem Entwicklungswerkzeug, ohne gepatchte Version** (Stand 2026-10-20:
`braces` über `eslint-config-next`) steht im Protokoll als "gemeldet, blockiert nicht"
und ist kein Fehlschlag, also auch kein Issue: es gäbe nichts zu entscheiden, und das
Issue bliebe offen, bis Upstream nachzieht. Er taucht in jedem Lauf des Gates auf, lokal,
in der CI und im täglichen Audit. Erkannt wird "ohne gepatchte Version" am Bereich des
Pakets im Bericht (`*`: jede veröffentlichte Version ist betroffen).

Der Lauf selbst wird bei einem Fehlschlag rot (Actions-Übersicht), ohne einen
Commit zu färben. **Meldeweg prüfen**, ohne dass es einen echten Fund gibt:
*Actions → Audit → Run workflow* mit `simulate_failure` angehakt (oder
`gh workflow run audit.yml -f simulate_failure=true`). Es entsteht ein Issue mit
dem Hinweis "Simulation"; danach von Hand schließen. Den Lauf ohne Haken
startet man ebenso, um nach einem Fix zu sehen, dass das Issue sich schließt.
Die Node-Version holt sich der Workflow aus `.nvmrc`.

### Node-Version

Eine Hauptversion für alles, was wir testen und ausliefern: **Node 24**. Bis zum
06.10.2026 lief Produktion auf 24 (Vercel), während CI, E2E, Docker und `.nvmrc`
auf 22 standen, getestet war also nie das, was ausgeliefert wurde.

Stand laut dem [offiziellen Release-Plan](https://github.com/nodejs/Release)
(`schedule.json`), geprüft am 06.10.2026: Node 24 ist Active LTS bis zum
20.10.2026, danach Maintenance, Support bis **30.04.2028**. Node 22 ist seit dem
21.10.2025 nur noch Maintenance (Support bis 30.04.2027), Node 20 ist seit dem
30.04.2026 abgekündigt. Node 26 wird am 28.10.2026 LTS, Vercel bietet laut seiner
API aber nur 24.x, 22.x und 20.x an.

Wo die Version steht (`tests/guards/node-version.test.ts` scheitert, wenn eine
Stelle abweicht):

| Stelle | Inhalt |
|---|---|
| `.nvmrc` | `24`, die Quelle der Wahrheit |
| `ci.yml`, `e2e.yml`, `audit.yml` | `setup-node` liest `.nvmrc` |
| `Dockerfile` | `node:24-alpine@sha256:…` in allen drei Stufen, derselbe Digest |
| `package.json` | `engines.node` = `24.x`, und `@types/node` auf `^24` |
| **Vercel-Projekt** | Einstellung "Node.js Version" = `24.x` (**außerhalb des Repositories, der Test kann sie nicht prüfen**) |

Vercel liest `engines.node` aus `package.json`, und das **übersteuert** die
Projekt-Einstellung. Entscheidend ist also die `engines`-Zeile, die der Test
prüft. Die Vercel-Einstellung trotzdem auf dieselbe Version zu stellen vermeidet,
dass sie bei einem späteren Löschen der `engines`-Zeile still etwas anderes
liefert.

**Hauptversion wechseln:** `.nvmrc`, `engines.node`, die drei `FROM` im
`Dockerfile`, `docs/DOCKER.md` und `@types/node` anheben (der Major ist für
Dependabot gesperrt, siehe `dependabot.yml`), die Vercel-Einstellung angleichen,
dann Gate, `npm run test:e2e` und ein Produktions-Deployment mit
`/api/health` abwarten.

**Basis-Image aktualisieren:** der Digest im `Dockerfile` zieht Sicherheitsupdates von
Node und Alpine nicht von selbst nach, das geschieht von Hand und bewusst. Neuen Wert lesen
(`docker buildx imagetools inspect node:24-alpine`, die Zeile `Digest:` des Index, damit
alle Plattformen gelten), in allen drei `FROM` ersetzen, der Docker-Workflow prüft das Image.

## Auth-Mails (eigener Versand)

**Vergebene Adressen:** Die Registrierung sagt, wenn eine Adresse schon ein Konto hat. Das nehmen wir hin (#230),
solange "Confirm email" aus ist: GoTrue meldet den Fall dann als Fehler, und eine neue Adresse bekommt sofort eine
Sitzung, verbergen liesse es sich also nicht. Anmeldung, Passwort-Reset und "erneut senden" verraten es nicht. Wird
"Confirm email" eingeschaltet, verschwindet auch dieser Unterschied.

Die App löst zwei Mails aus: die **Bestätigung** bei der Registrierung (samt
"erneut senden") und den **Passwort-Reset**. Beide laufen über Supabase Auth, und
ohne eigenen SMTP-Server über dessen Standardversand. Das ist für Produktion
nicht gedacht ([Supabase-Doku](https://supabase.com/docs/guides/auth/auth-smtp),
gelesen am 06.10.2026):

- **Nur Adressen aus dem Team des Projekts.** Ohne eigenen SMTP verweigert
  Supabase Auth die Zustellung an jede andere Adresse ("Email address not
  authorized").
- Ein niedriges Limit, das sich ohne Ankündigung ändern kann.
- Keine Zusage zu Zustellung oder Verfügbarkeit.

### Stand (06.10.2026), und was daran nicht belegt ist

Belegt (Auth-Logs und `auth.users`, nur Zähler gelesen):

- **Registrierungen laufen ohne Mail.** Eine Registrierung vom 05.10.2026 wurde
  sofort eingeloggt (`immediate_login_after_signup`), und bei keinem der 5 Konten
  wurde je eine Bestätigung ausgelöst. "E-Mail bestätigen" ist in Produktion also
  aus. Das ist auch eine Lücke: wer sich mit fremder Adresse anmeldet, muss sie
  nicht besitzen. Einschalten geht erst mit funktionierendem Versand (sonst kommt
  niemand mehr ins Konto).
- **Passwort-Reset trifft jeden außer dem Team.** Wer sein Passwort vergisst,
  bekäme die Mail nicht, solange kein eigener SMTP eingetragen ist.
- **Die DNS-Zone von `promptprinter.app` liegt bei Vercel** (`ns1/ns2.vercel-dns.com`)
  und trägt **weder MX noch SPF, DKIM oder DMARC**. Die Kontaktadresse der Seite
  ist eine Gmail-Adresse (`legal.ts`), es gibt also kein Postfach unter der Domain.

**Nicht belegt, nur das Dashboard zeigt es:** ob ein eigener SMTP eingetragen ist
(im Repository und in den Logs deutet nichts darauf hin), die Vorlagen, die dort
heute stehen, und die dort gesetzten Limits. Nachsehen (nur lesen):

1. *Authentication → Emails → SMTP Settings*: Schalter "Enable custom SMTP" (aus
   = Standardversand), Absender, Host.
2. *Authentication → Rate Limits*: "Rate limit for sending emails".
3. *Authentication → Sign In / Providers → Email*: "Confirm email".
4. *Authentication → Emails → Templates*: Text und Link von "Confirm signup" und
   "Reset Password".
5. *Authentication → URL Configuration*: Site URL `https://promptprinter.app`,
   Redirect URLs enthalten `https://promptprinter.app/**` (ohne sie ignoriert
   Supabase das `redirectTo` der App und schickt auf die Site URL).

### Gewählt: Resend (15.10.2026)

Statt Brevo (der Abschnitt darunter bleibt als Alternative) läuft der Versand über
**Resend**, weil Kasum dort schon ein Konto hat (Artemis Hebammen, Kazuvate). Stand:

- **Domain** `promptprinter.app` in Resend, Region **Irland (eu-west-1)**, Status "Verified".
  Resend hat die DNS-Einträge über die Vercel-Anbindung selbst angelegt: TXT
  `resend._domainkey` (DKIM) und die CNAME `send` und `rsend`. Den `_dmarc`-Eintrag
  (TXT `v=DMARC1; p=none;`, nur beobachten, nichts abweisen) hat Claude am 15.10.2026 bei
  Vercel angelegt und gegen `ns1.vercel-dns.com` gelesen.
- **Supabase** (*Authentication → Emails → SMTP Settings*): Host `smtp.resend.com`, Port
  `465`, Benutzer `resend`, Passwort = ein Resend-API-Key nur für diese Domain
  (*Sending access*), Absender `noreply@promptprinter.app`, Name `PromptPrinter`. Das
  Limit bleibt bei 30 Mails pro Stunde (Resends Gratis-Tarif erlaubt laut Plan 100 am Tag).
- **Vorlagen** aus `supabase/templates/` im Dashboard eingefügt, auf Kasums Angabe.
- **Nicht belegt:** dass je eine Mail zugestellt wurde. Es gab keinen Test mit einer
  fremden Adresse (Kasum wollte keinen). "Confirm email" bleibt deshalb **aus**: es
  einzuschalten, ohne dass der Versand je lief, ließe jede neue Registrierung ohne Zugang,
  sobald er klemmt. Prüfen: Schritt 7 unten (Reset mit einer Adresse außerhalb des Teams),
  bei Fehlern die SQL aus Schritt 7 und in Resend *Logs*.
- **Datenschutz:** Resend (Plus Five Five, Inc., USA; Versand aus Irland, Vertrag sieht
  überwiegend die USA vor, Aufbewahrung der Mailinhalte 30 Tage) steht als Empfänger in
  Ziffer 2, 4, 5 und 6 der Datenschutzerklärung (Stand 15.10.2026). Ob die Firma zum Data
  Privacy Framework zertifiziert ist, ist **nicht geprüft** und steht deshalb nicht im Text;
  die Übermittlung stützt sich auf die Standardvertragsklauseln. Juristisch ansehen lassen.

### Einrichten (Brevo)

Brevo ist nur der Vorschlag (französische Firma, EU-Datenhaltung als Standard,
SMTP-Relay), **gebucht ist nichts**. Die Gratis-Konditionen (laut Drittquellen 300
Mails pro Tag) vor der Buchung auf brevo.com selbst prüfen. Ein anderer Anbieter
ändert nur die Werte in den Schritten 2 bis 4.

1. **Konto** bei Brevo anlegen. Der Anbieter ist neuer Auftragsverarbeiter:
   Auftragsverarbeitungsvertrag annehmen, und der Datenschutz-Text muss vor dem
   ersten Versand stehen (Entwurf im Vault, juristisch ansehen lassen).
2. **Absender-Domain** `promptprinter.app` in Brevo hinzufügen (*Senders, Domains
   & Dedicated IPs → Domains*). Brevo zeigt dann **drei DNS-Einträge** an
   ([Anleitung von Brevo](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC)):

   | Eintrag | Zweck | Wert |
   |---|---|---|
   | TXT "Brevo code" | beweist, dass die Domain dir gehört | von Brevo angezeigt |
   | DKIM (1 TXT oder 2 CNAME) | signiert jede Mail | von Brevo angezeigt |
   | TXT `_dmarc` | sagt Empfängern, was mit unsignierten Mails passiert | Brevo schlägt `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` vor |

   Die Werte **nicht raten, nicht abtippen**: von Brevo kopieren. Einen SPF-Eintrag
   nennt Brevo nicht als Pflicht, die Domain hat heute keinen. DMARC mit `p=none`
   beobachtet nur; erst wenn die Berichte nach einigen Wochen sauber sind, auf
   `quarantine` heben.

   **Wo eintragen:** Vercel → *Domains* → `promptprinter.app` → *DNS Records* →
   *Add*, oder `vercel dns add promptprinter.app <Name> TXT "<Wert>"`. Ein TXT-
   oder CNAME-Eintrag berührt die A-Einträge der Webseite nicht. Danach in Brevo
   "Authenticate" drücken und auf grünes Häkchen warten. Absender:
   `noreply@promptprinter.app`, ein Absender in der Domain **ohne Postfach**.
   Antworten gehen ins Leere, und Supabases SMTP-Maske kennt kein Reply-To. Die
   Vorlagen bitten deshalb nie um eine Antwort, und der Impressum-Link darin
   führt zur Kontaktadresse.
3. **SMTP-Zugang** in Brevo (*SMTP & API → SMTP*): Host `smtp-relay.brevo.com`,
   Port `587`, Benutzer = der dort angezeigte SMTP-Login, Passwort = ein neu
   erzeugter **SMTP-Schlüssel**. Der Schlüssel gehört nur in das Supabase-
   Dashboard, nie in dieses Repository, nie in Vercel, nie in einen Chat.
4. **Supabase** (*Authentication → Emails → SMTP Settings*): "Enable custom SMTP"
   einschalten, Host, Port, Benutzer, Passwort aus Schritt 3, Absenderadresse
   `noreply@promptprinter.app`, Absendername `PromptPrinter`.
5. **Limit anheben** (*Authentication → Rate Limits → Rate limit for sending
   emails*): Mit eigenem SMTP gilt laut Supabase zunächst ein niedriges Limit (30
   Mails pro Stunde). Auf einen Wert stellen, der zu Brevos Tageslimit passt.
6. **Vorlagen einfügen** (*Authentication → Emails → Templates*). Die Quelle sind
   die Dateien im Repository, Betreff und Text jeweils kopieren:

   | Vorlage im Dashboard | Datei | Betreff | Löst die App aus? |
   |---|---|---|---|
   | Confirm signup | `supabase/templates/confirmation.html` | Bestätige deine E-Mail-Adresse für PromptPrinter | ja |
   | Reset Password | `supabase/templates/recovery.html` | Passwort zurücksetzen bei PromptPrinter | ja |
   | Change Email Address | `supabase/templates/email_change.html` | Bestätige deine neue E-Mail-Adresse | nein (gibt es nicht) |
   | Invite user | `supabase/templates/invite.html` | Du wurdest zu PromptPrinter eingeladen | nein (nur über das Dashboard) |

   *Magic Link* und *Reauthentication* lösen weder App noch Dashboard aus, ihr
   englischer Standardtext bleibt, wie er ist. **Jeder Link in den Vorlagen läuft
   über `/auth/callback`** (`token_hash` + `type`, kein `ConfirmationURL`), weil
   die Route nur diese Form und den PKCE-`code` kennt.
   `tests/guards/auth-mail-templates.test.ts` hält die Dateien fest; **er sieht
   das Dashboard nicht**: wer eine Datei ändert, fügt sie dort neu ein.

   **Warum `token_hash` und nicht Supabases `ConfirmationURL`:** der Link geht auf
   jedem Gerät (Mail am Handy öffnen, Reset am Rechner angefordert). Die
   `ConfirmationURL` ist ein PKCE-Link und geht nur in dem Browser, der den Reset
   angefordert hat. Der `token_hash`-Weg stellt bei GoTrue immer die
   Anmeldemethode `otp` aus (nicht `recovery`), und die Seite "Neues Passwort"
   (`src/features/auth/lib/recovery-session.ts`) lässt eine frische `otp`-Sitzung
   (höchstens 10 Minuten alt) deshalb durch. Bis zum 06.10.2026 tat sie das nicht:
   jeder Reset über diese Vorlage endete bei "Link ungültig". Gefunden hat es
   `e2e/password-reset.spec.ts`. Steht im Dashboard noch die Standardvorlage mit
   `ConfirmationURL`, funktioniert der Reset weiter (dann nur im selben Browser).
7. **Mit einer echten Registrierung und einem echten Reset prüfen** (Kasum, mit
   einem Postfach, das nicht zum Team gehört): Passwort-Reset anfordern, Mail im
   Postfach (und nicht im Spam?) öffnen, neues Passwort setzen, einloggen. Danach
   in den Auth-Logs nach Fehlern sehen (nur lesen):

   ```sql
   select timestamp, event_message from logs
   where source = 'auth_logs'
     and (event_message ilike '%smtp%' or event_message ilike '%authorized%'
          or event_message ilike '%rate%' or event_message ilike '%mail%')
   order by timestamp desc limit 30
   ```

   Gesucht: `Email address not authorized` (SMTP nicht aktiv), `over_email_send_rate_limit`
   (Limit aus Schritt 5), SMTP-Verbindungsfehler (falscher Host, Port oder Schlüssel).
   Die Logs behalten auf dem Gratis-Tarif nur einen Tag.
8. **Erst danach** (und nur wenn gewollt): "Confirm email" einschalten. Dann
   bekommt jedes neue Konto die Bestätigungsmail, und der Registrierungs-
   Bildschirm zeigt "Schau in dein Postfach" statt des Sofort-Logins.

## KI-Kennzeichnung (EU-KI-Verordnung Art. 50)

Stand 2026-10-17, Rechts-Audit R-9. **Keine Rechtsberatung, und aus Sekundärquellen: weder den Verhaltenskodex
(10.06.2026) noch die Leitlinien der Kommission (C(2026) 5054, 20.07.2026) habe ich im Wortlaut gelesen.**

- **Abs. 1 (Chatbot sagt, dass er eine KI ist):** erledigt. "Finn ist eine KI und kann Fehler machen." steht
  dauerhaft unter dem Eingabefeld (seit 2026-09-28).
- **Abs. 2 (Ausgabe maschinenlesbar kennzeichnen):** gilt seit 2026-08-02; für Systeme, die vor diesem Tag am
  Markt waren, gilt laut Berichten über den Digital Omnibus **2026-12-02**. Ob PromptPrinter davor am Markt war,
  weiss Kasum. Ob ein Chat, der Prompts als Text erzeugt, unter die Ausnahme "Unterstützung
  bei der Standardbearbeitung / keine wesentliche Änderung der Eingabe" fällt, ist **offen**: Finn erzeugt neuen
  Text aus einer Idee, die Ausnahme dürfte also nicht greifen.
- **Was umgesetzt ist** (`shared/lib/ai-marker.ts`): eine erste, maschinenlesbare Schicht. Die Antwort von `/api/chat`
  trägt `x-ai-generated: true`; eine heruntergeladene Markdown-Antwort beginnt mit einem HTML-Kommentar
  (`<!-- ai-generated: true; … -->`); eine exportierte PDF trägt die Eigenschaften Betreff und Schlüsselwort
  und unten auf jeder Seite "mit KI erzeugt".
- **Was nicht:** das Wasserzeichen (für reinen Text gibt es kein anerkanntes Verfahren; der Kodex verlangt
  "mindestens zwei Schichten" und nennt keine Einzelmethode), ein Weg, die Herkunft zu prüfen (Erkennungsschnittstelle),
  und eine Markierung im Text selbst, den man kopiert: ein Zusatz im Prompt würde das Ergebnis in der anderen
  KI verändern. Ob eine Schicht reicht, ist offen. Hat Z.ai die Ausgabe schon selbst gekennzeichnet, ist die
  Frage, wer als Anbieter gilt, wenn man ein fremdes Modell einbindet: auch das steht nicht in meinen Quellen.
- **Beobachten:** Kodex und Leitlinien im Wortlaut lesen (Kommission, digital-strategy.ec.europa.eu), vor dem 2. Dezember.

## Sitzungs-Cookie (Entscheid: bleibt lesbar)

Das Sitzungs-Cookie von Supabase ist nicht `HttpOnly` und lebt 400 Tage (Vorgabe von `@supabase/ssr`). Das bleibt so, bewusst:

- **HttpOnly bricht die App.** `createBrowserClient` liest die Sitzung aus `document.cookie`, und 18 Browser-Dateien nutzen diesen Client (Anmeldung per OAuth, Passwort ändern, Chats, Projekte, Dateien, Prompts, Einstellungen, Befehlspalette). Ohne lesbares Cookie wären sie alle nicht angemeldet. Vorher müsste jeder dieser Zugriffe hinter eine Server-Route, Datei-Uploads hinter signierte Adressen: ein eigener Umbau.
- **Ein kürzeres `maxAge` allein schützt kaum.** Ein ausgelesenes Refresh-Token hängt nicht am Cookie im Browser des Angreifers, und eine feste Höchstdauer der Sitzung bräuchte eine eigene Prüfung auf dem Server. Kosten für echte Nutzer: häufigeres Abmelden.
- **Was den Schaden begrenzt:** CSP mit Nonce auf den App-Routen, kein rohes HTML aus Markdown, frische Anmeldung vor dem Löschen des Kontos (`features/auth/lib/fresh-sign-in.ts`).

Einstellungen der Produktion, am 2026-11-02 im Dashboard gelesen (Authentication → Sessions), nichts geändert:

| Einstellung | Wert | Bedeutung |
|---|---|---|
| Time-box user sessions | 0 (nie) | Keine Höchstdauer, nur im Pro-Tarif von Supabase änderbar |
| Inactivity timeout | 0 (nie) | Kein Abmelden nach Inaktivität, nur im Pro-Tarif änderbar |
| Enforce single session per user | aus | Mehrere Geräte zugleich, nur im Pro-Tarif änderbar |
| Access token expiry | 3600 Sekunden | Ein ausgelesenes Access-Token gilt höchstens eine Stunde |
| Detect and revoke compromised refresh tokens | an | Wird ein schon rotiertes Token wiederverwendet, widerruft Supabase die Sitzung |
| Refresh token reuse interval | 10 Sekunden | Solange gilt ein rotiertes Token noch als derselbe Vorgang (für Tabs, die gleichzeitig erneuern) |

Eine Sitzung läuft also nicht von selbst ab. Was sie beendet: Abmelden, Löschen des Kontos oder die Wiederverwendung eines rotierten Tokens, die bei einem gestohlenen Token auffällt, sobald Angreifer und Nutzer es beide erneuern.

## Kontaktformular

`/kontakt` hat neben der Mailadresse ein Formular (`ContactForm`, Name freiwillig, E-Mail, Thema, Nachricht
mit 10 bis 4000 Zeichen). Es ist der zweite schnelle Kontaktweg, den das Impressum für Besucher aus
Deutschland braucht. Es sendet an `POST /api/contact`, die Route schickt die Nachricht per
`server/mail/resend.ts` an `LEGAL.email` (Antwortadresse = die des Absenders) und **speichert nichts**.

- **Einrichten:** in Resend einen API-Key mit *Sending access* für `promptprinter.app` anlegen, in
  Vercel als `RESEND_API_KEY` (Production) eintragen, neu deployen. Ohne den Wert antwortet die Route
  mit 503 und der Mailadresse im Text; die Seite bleibt benutzbar.
- **Schutz:** Ratenlimit 5 Nachrichten je Stunde und IP, **20 je Tag insgesamt** (das Resend-Konto ist
  dasselbe wie das der Auth-Mails, der Gratis-Tarif erlaubt 100 am Tag: ohne die zweite Grenze könnte ein
  Schwarm den Reset-Link echter Nutzer verdrängen), Köderfeld `website`, die Mensch-Prüfung von
  Cloudflare (`/kontakt` steht in `thirdPartiesFor()`, das Widget liegt jetzt in `shared/ui`).
- **Meldeweg für rechtswidrige Inhalte (Digital Services Act, Art. 16):** das Thema "Rechtswidrigen Inhalt
  melden" im Formular (`CONTACT_TOPICS`, `melden`). Nur dort bestätigt die Route den Eingang per Mail an den
  Absender (Art. 16 Abs. 4), ohne dessen Nachricht zu wiederholen; bei jedem anderen Thema wäre eine
  Bestätigung an eine eingetippte Adresse ein Weg, Dritten Mails zuzustellen. Scheitert die Bestätigung, ist
  die Meldung trotzdem angekommen (Logeintrag `contact.ack_failed`). Die Entscheidung teilt Kasum von Hand mit.
- **Datenschutz:** Ziffern 2 (Kontaktformular), 3, 4 (Cloudflare, Resend), 6 und `/cookies`. Wer Felder
  ändert oder die Nachricht irgendwo speichert, zieht die Texte mit.
- **Nicht belegt:** dass eine Mail im Postfach ankommt. Der Versand lief nie gegen den echten Dienst
  (kein Schlüssel in der Entwicklung); der erste Test ist eine eigene Nachricht über das Formular.

## Grenzen je Konto

Der Browser schreibt mit dem JWT des Nutzers direkt in die Datenbank, an den API-Routen und ihrem Ratenlimit vorbei. Deshalb stehen die Grenzen in der Datenbank (Migration `*_account_ceilings.sql`), als Trigger und in der Storage-Policy. Sie gelten über jeden Weg, auch über den Service-Role-Client. Die Zahlen stehen auch in `src/shared/lib/plans.ts`, `tests/guards/account-ceilings.test.ts` hält beide gleich, `e2e/account-limits.spec.ts` prüft die Wirkung gegen den lokalen Stack.

| Was | Grenze je Konto | Gilt für |
|---|---|---|
| Projekte | 3 | Plan Free. Pro und Admins ohne Grenze (`PLAN_LIMITS`) |
| Chats (`conversations`) | 10 000 Zeilen | alle |
| Nachrichten (`messages`) | 50 000 Zeilen, 50 MiB | alle |
| Gespeicherte Prompts (`saved_prompts`) | 5 000 Zeilen, 20 MiB | alle |
| Dateizeilen (`project_files`) | 500 Zeilen | alle |
| Objekte im Bucket `project-files` | 500 Objekte, 100 MiB | alle |

Dazu kommen die älteren Grenzen je Projekt (20 Dateien, 25 MiB) und je Konto für Chat-Anhänge (die Route, `chat-limits.ts`).

**Warum diese Zahlen.** Das aktivste Konto der Produktion hatte am 2026-11-02 89 Nachrichten (48 kB), 19 Chats, 3 gespeicherte Prompts und keine Dateien, die Datenbank war 13 MB gross. 50 000 Nachrichten sind 40 am Tag über mehr als drei Jahre. Free erreicht mit 3 Projekten höchstens 75 MiB Dateien. Zeilen allein reichen nicht: 50 000 Nachrichten mit je 40 000 Zeichen wären 2 GB. Die Bytes zählt `pg_column_size`, also den belegten Platz nach der Kompression.

**Was sie nicht leisten.** Ein Konto belegt höchstens rund 85 MiB Datenbank und 100 MiB Speicher. Bei den Kontingenten des Supabase-Free-Tarifs (500 MB, 1 GB) reichen also ein paar Konten, um sie zu füllen, die Grenzen machen das nur teurer. Davor stehen die Anmeldung mit Turnstile und das Ratenlimit. Die Belegung steht im Supabase-Dashboard unter Organization → Usage, einen Alarm dafür gibt es nicht.

**An der Grenze.** Bestehende Daten bleiben: die Trigger laufen nur beim Einfügen, auch ein Konto über einer Grenze kann alles lesen, ändern und löschen und legt wieder an, sobald es darunter liegt (etwa nach einem Wechsel von Pro zu Free). Die Datenbank antwortet mit einem Fehler (`P0001`, "Obergrenze des Kontos erreicht" oder "Projekt-Limit des Plans erreicht"), bei Dateien im Bucket mit einem Policy-Fehler. Die Oberfläche zeigt die allgemeine Fehlermeldung der jeweiligen Stelle, einen eigenen Text gibt es bewusst nicht, weil normale Nutzung nie anstösst. Nur `/api/projects` antwortet vorher freundlich. Im Chat: scheitert die Frage, antwortet die Route mit 503 und gibt die Reservierung zurück; passt nur die Antwort nicht mehr, kommt sie im Browser an, wird aber nicht gespeichert.

**Grenzfälle.** Parallele Einfügungen eines Kontos reiht eine Sperre (`pg_advisory_xact_lock`) hintereinander, die Grenze hält dabei genau. Im Bucket geht das nicht, weil die Grösse erst nach dem Hochladen feststeht: ein Upload kann die Bytes um höchstens ein Objekt (2 MiB) überschreiten, parallele Uploads um je eines. Die Zählung kostet an der Grenze von 50 000 Nachrichten rund 8 ms je Einfügung (lokal gemessen).

**Wer eine Zahl ändert:** neue Migration mit `create or replace` beziehungsweise neuem Trigger, `ACCOUNT_CEILINGS` in `plans.ts`, dieser Abschnitt, und den Guard auf die neue Datei richten.

## Zahlungen: Webhook (Lemon Squeezy)

`/api/webhooks/lemonsqueezy` schaltet Pro frei und nimmt es zurück. Im Lemon-Squeezy-
Dashboard (*Settings → Webhooks*) muss ein Webhook auf
`https://promptprinter.app/api/webhooks/lemonsqueezy` zeigen, sein Signing Secret steht als
`LEMON_SQUEEZY_WEBHOOK_SECRET` in Vercel. **Test- und Live-Modus haben getrennte Webhooks**
([Doku](https://docs.lemonsqueezy.com/guides/developer-guide/testing-going-live)): wer im
Testmodus prüft, legt dort einen eigenen an (mit eigenem Secret).

Gegen die Doku gelesen und geprüft am 07.10.2026 (Quellen im Kopf von
`src/server/billing/lemonsqueezy.docs.test.ts`):

- **Anzuhakende Ereignisse**, alle anderen quittiert der Code mit 200 und protokolliert sie als
  ignoriert: `order_created`, `order_refunded`, `subscription_created`, `subscription_updated`,
  `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`,
  `subscription_unpaused`, `subscription_payment_success`, `subscription_payment_recovered`,
  `subscription_payment_refunded`. Unnötig: `subscription_payment_failed` (der Zustand `past_due`
  kommt über das Abo), `customer_updated`, `license_key_*`, `affiliate_activated`.
- **Signatur:** `X-Signature`, HMAC-SHA256 hexadezimal über den rohen Rumpf. Der Code prüft genau das,
  zeitkonstant.
- **Wiederholungen:** bei jeder anderen Antwort als 200 stellt Lemon Squeezy bis zu **dreimal** erneut
  zu (5, 25 und 125 Sekunden später), also rund zweieinhalb Minuten lang. Danach kommt dieselbe
  Zustellung nicht mehr von selbst: die Zeile in `billing_events` bleibt auf `failed`, und es hilft nur
  ein erneutes Senden aus dem Dashboard (nicht belegt, ob es dort einen Knopf dafür gibt) oder die
  Freischaltung von Hand.
- **Entscheidungen:** Abo-Status `on_trial`, `active`, `past_due`, `cancelled` → Pro; `paused`,
  `unpaid`, `expired` → Free. Erstattung: **voll** (`refunded`) → Free, **teilweise** (`partial_refund`)
  → Pro bleibt (die Doku sagt, `order_refunded` feuert bei beidem). Zuordnung: Konto-ID aus dem Checkout
  (`custom_data.user_id`, nur für eine Gutschrift, gegen `profiles` geprüft) oder Kundennummer (jeder
  Entzug).
- **Testmodus:** `test_mode` steht an Order, Abo und Rechnung (nicht in `meta`). Ein Ereignis mit
  `test_mode: true` ändert kein Konto: Die Route quittiert es mit 200, die Zeile in `billing_events`
  steht auf `ignored` mit `Testmodus` (Testkarten sind öffentlich). Wer den Weg ausserhalb der Produktion
  prüft, setzt `LEMON_SQUEEZY_ACCEPT_TEST_MODE=1`; auf Vercel mit `VERCEL_ENV=production` wirkt der Schalter
  nicht. Im Log trägt `billing.webhook_applied` (und `_unmatched`, `_ignored`) `testMode: true` oder `false`.
- **Nicht belegt, nur mit einem echten Ereignis zu sehen:** welche Ereignisse bei einem echten Kauf
  zusammen eintreffen und in welcher Reihenfolge, ob `subscription_paused` und `subscription_updated`
  beide kommen, die Adresse des Testmodus-Webhooks, Preise brutto oder netto.
- **Kundenportal-Adresse:** `urls.customer_portal` ist laut Beispiel der Doku eine signierte Adresse mit
  `expires=…` und `signature=…`; wie lange sie gilt, nennt die Doku nicht. Die App speichert sie beim Abo-
  Ereignis (`subscription_portal_url`), und die Abrechnungsseite (`/billing`) verlinkt genau diese gespeicherte
  Adresse, sie holt nie eine frische (`LEMON_SQUEEZY_API_KEY` dient nur dem Beenden eines Abos beim Löschen
  des Kontos und ist in Produktion nicht gesetzt). **Ist die Adresse abgelaufen, führt "Abo verwalten" ins
  Leere:** das ist am ersten echten Abo zu prüfen. Die feste Adresse des Portals ist
  `https://<shop>.lemonsqueezy.com/billing` (der Kunde meldet sich dort per Link an die Mail an).

## Ende-zu-Ende-Tests

Die Unit-Tests prüfen Bausteine, nicht, ob ein eingeloggter Nutzer durch das
Produkt kommt. Die Smoketests in [`e2e/`](../e2e) bedienen die App im echten
Browser (Playwright, Chromium) gegen einen **lokalen Supabase-Stack**, nie gegen
ein gehostetes Projekt.

### Ablauf

Voraussetzungen: Docker und die Supabase-CLI (Version wie in
[`e2e.yml`](../.github/workflows/e2e.yml), derzeit 2.119.0).

```bash
supabase start          # baut die Datenbank aus supabase/migrations/ neu auf
npm run test:e2e        # startet einen eigenen Dev-Server auf Port 3100
supabase stop           # danach (optional, --no-backup verwirft die Daten)
```

Ohne installierte CLI geht es auch so (Windows, Git Bash):

```bash
export E2E_SUPABASE_CLI="npx --yes supabase@2.119.0"
npx --yes supabase@2.119.0 start
npm run test:e2e
```

Einmalig: `npx playwright install chromium`. Ein einzelner Test:
`npx playwright test e2e/chat.spec.ts --project desktop`; mit Browserfenster
`--headed`; einen fehlgeschlagenen Lauf sieht man mit
`npx playwright show-report`.

### Was geprüft wird

| Datei | Prüft |
|---|---|
| `smoke.spec.ts` | der Test-Server spricht nur mit dem lokalen Stack (kein Supabase-Projekt, kein Turnstile aus `.env.local`), öffentliche Seiten antworten, Unbekanntes ist 404, die App ist ohne Anmeldung zu |
| `auth.spec.ts` | Registrieren, Abmelden, Anmelden über die Formulare, falsches Passwort, schwaches Passwort wird im Server abgewiesen |
| `password-reset.spec.ts` | Passwort-Reset über die **echte Mail** (lokales Postfach, Mailpit): Vorlage aus `supabase/templates/`, Link über `/auth/callback` mit `token_hash`, neues Passwort gilt, altes nicht, der Link ist nur einmal gültig |
| `chat.spec.ts` | Frage senden und Antwort, nach dem Neuladen noch da; Textanhang landet in Tabelle UND Speicher, byte-gleich; ein Free-Konto sieht den Key-Hinweis vor dem Tippen |
| `projects.spec.ts` | Projekt anlegen, Anweisungen speichern, Datei hochladen, Chat im Projekt, Löschen räumt Zeilen und Dateien im Speicher auf |
| `account.spec.ts` | Datenexport (eigene Daten ja, fremde und Geheimnisse nein), Sprachwechsel, Konto löschen samt Dateien |
| `billing-webhook.spec.ts` | der Zahlungsweg mit **selbst signierten** Lemon-Squeezy-Ereignissen gegen die lokale Datenbank: Abo wird Pro, dieselbe Zustellung zweimal wirkt nur einmal, Kündigung und Ablauf, falsche Signatur wird abgewiesen, Konto-Übernahme gelingt nicht, Teilerstattung lässt Pro stehen |
| `mobile.spec.ts` | Telefonmaß (Pixel 7): Menü, Chat, keine Seite läuft über den Rand |

### Was bewusst NICHT geprüft wird

- **Eine echte KI-Antwort.** Es ist kein Modell-Anbieter konfiguriert, der Chat
  antwortet mit der Demo-Antwort (Stub-Modus, nur in Entwicklung erlaubt, daher
  läuft der Test-Server im Dev-Modus). Dass die Antwort gut ist, prüft kein Test.
- **Der Sprachmodus.** Die Web Speech API gibt es in einem automatisierten
  Chromium nicht verlässlich, und ein Mikrofon gibt es nicht.
- **Ein echtes Ereignis von Lemon Squeezy** (der Webhook selbst wird mit selbst
  signierten Ereignissen geprüft, siehe oben), der Checkout, die Testmodus-Adresse
  im Dashboard und die Preise inklusive Mehrwertsteuer. **Turnstile**, **Upstash/Redis**,
  die **Bestätigungsmail bei der Registrierung**, **OAuth** (Google/GitHub).
  Der lokale Stack hat die Bestätigungsmail ausgeschaltet (`supabase/config.toml`),
  und Produktion läuft laut Auth-Logs (06.10.2026) ebenfalls ohne. Die Mail des
  Passwort-Resets dagegen wird geprüft (`password-reset.spec.ts`), **nicht aber**
  was im Dashboard der Produktion als Vorlage oder SMTP steht.
- **Den Produktions-Build.** `next start` verweigert den Stub-Chat, deshalb
  läuft hier der Dev-Server. Den Produktions-Build prüft ein eigener, kleiner
  Lauf (nächster Abschnitt); den Chat dort nicht.
- **Last, andere Browser, Tastatur-Barrierefreiheit.** Nur Chromium, ein Nutzer.
- **fr/it/es.** Die Tests laufen auf Deutsch, der Sprachwechsel nur auf Englisch.

### Browser-Test gegen den Produktionsaufbau

Die Smoketests laufen im Entwicklungsmodus. Dort gilt eine andere
Content-Security-Policy (`'unsafe-eval'` ist erlaubt), und es läuft weder das
gebaute Bündel noch der statisch ausgelieferte Seitenbaum. Ein Fehler in der
Policy macht aber genau dort alle öffentlichen Seiten leer (05.08.2026,
Kommentar in `src/server/security/csp.ts`) und fiel bisher erst den ersten
echten Besuchern auf (#220). `e2e/prod/produktion.spec.ts` fährt deshalb
`next build` und `next start` mit `NODE_ENV=production` und öffnet die Seiten in
Chromium; Workflow [`e2e-prod.yml`](../.github/workflows/e2e-prod.yml), eigener
Lauf neben `e2e.yml`.

```bash
supabase start
npm run test:e2e:prod            # baut selbst, einige Minuten
E2E_PROD_SKIP_BUILD=1 npm run test:e2e:prod   # nur wiederholen, der letzte Build gilt
```

Der Lauf überschreibt `.next`: ein Dev-Server im selben Ordner gehört vorher
gestoppt. Port 3101 (`E2E_PROD_PORT`), neben dem Dev-Server der Smoketests auf 3100.

| Prüfung | Inhalt |
|---|---|
| Öffentliche Seiten (`/`, `/login`, `/signup`, `/reset-password`, `/pricing`, `/docs`, `/skill`, `/vergleich`, `/ueber`, eine 404-Seite) | Antwort mit der statischen Policy (`'unsafe-inline'`, kein Nonce, **kein** `'unsafe-eval'`, `script-src-attr 'none'`), HSTS und die übrigen Köpfe aus `next.config.ts`, kein `securitypolicyviolation`, keine Konsolenfehler, keine fehlgeschlagene Anfrage |
| Hydration | das Menü der Navigation öffnet sich im Telefonmaß (`/`, `/pricing`, `/docs`): es reagiert nur, wenn Nexts Hydrationsskripte gelaufen sind. Auf den Anmeldeseiten, die bewusst bei `'unsafe-inline'` bleiben (#238): der Knopf am Passwortfeld (`/login`, `/signup`), die Prüfung der Adresse im Formular (`/reset-password`). Turnstile lädt hier nicht, die Umgebung hat keinen Site-Key |
| `/api/health` | `ok`: der Start in Produktion (`env.ts`) ist mit den dokumentierten Pflichtvariablen durchgelaufen |
| `/chats/new` mit Anmeldung | Nonce-Policy ohne `'unsafe-inline'`; jedes Inline-Skript trägt genau diesen Nonce; die Eingabe reagiert; ein eingeschleustes Inline-Skript ohne Nonce läuft **nicht** und wird gemeldet (Gegenprobe, damit der Hörer nicht still bleibt, weil er nichts mehr sieht) |

Zwei Ausnahmen in der Konsolenprüfung, beide mit Grund im Test: `/_vercel/…`
(Speed Insights, den Pfad gibt es nur auf Vercel; die Antwort wird ersetzt) und
der Prefetch einer App-Seite, dessen Weiterleitung auf `/login` der Browser wegen
`upgrade-insecure-requests` auf https umstellt (nur auf der http-Adresse der Tests).
Die Anmeldung läuft über Cookies, die der Test mit `@supabase/ssr` selbst
schreibt, nicht über `/api/auth`: in Produktion fehlt dem Test ein echtes Upstash,
und das Ratenlimit antwortet dann mit 429.

**Gegengeprüft am 2026-11-01** (jeweils Fehler eingebaut, neu gebaut, der Test lief
rot, Quelltext wiederhergestellt): das Nonce in `(app)/layout.tsx` weggelassen (der
Test der App-Seite scheitert am Inline-Skript ohne Nonce) und `isAppPath()` immer wahr
gemacht, sodass jede Seite die strenge Policy bekommt (elf der zwölf Tests der
öffentlichen Seiten scheitern: falsche Policy und ein Menü, das sich nicht öffnet).

### Wie nah der lokale Stack an der Produktion ist

Am 05.10.2026 gemessen: nach `supabase start` stimmen Spalten, Richtlinien,
RLS-Stand, Indizes, Buckets sowie Tabellen- und Spaltenrechte für `anon` und
`authenticated` mit der Produktions-Datenbank überein (Hash über die sortierte
Liste, Zahl der Zeilen gleich). Die einzigen Unterschiede sind bekannt:

- Migration 0043 ist in Produktion noch nicht angewendet (Tabelle
  `subscriptions` und Spalte `profiles.stripe_customer_id` gibt es dort noch).
- `public.rls_auto_enable()` legt Supabase nur auf gehosteten Projekten an.
- Migration 0046 (`set_active_byok_provider` nicht mehr für `anon`) ist dort
  ebenfalls noch offen.

Dafür waren zwei Eingriffe im Repository nötig, und beide sind Absicht:

1. **`0003_harden_functions.sql`** setzte ein `REVOKE` auf `rls_auto_enable()`
   voraus, die es lokal nicht gibt: das Schema war aus dem Repository nicht
   nachbaubar. Das `REVOKE` ist jetzt bedingt (`to_regprocedure`), die Wirkung
   auf einem gehosteten Projekt ist unverändert.
2. **`supabase/roles.sql`** nimmt `anon` und `authenticated` die automatischen
   Rechte auf neu angelegte Tabellen (`alter default privileges`). Der lokale
   Stack vergibt sie von sich aus, Produktion nicht. Ohne diese Datei fiele ein
   vergessenes `GRANT` in einer Migration lokal nie auf und wäre in Produktion
   ein „permission denied": genau der Fehler, den 0002 einmal behoben hat.

### Sperren

- `e2e/support/env.ts` verweigert jede Datenbank-Adresse außer `127.0.0.1` und
  `localhost`. Die Tests legen Konten an und löschen sie wieder.
- Der Test-Server bekommt seine Umgebung vollständig vom Test: alle Dienste, die
  er nicht nutzen darf (Modell-Anbieter, Upstash, Turnstile, Zahlung,
  Alarm-Webhook, GitHub-Token), stehen auf leer und schlagen damit die echte
  `.env.local`. `smoke.spec.ts` prüft das an Werten, die dort wirklich stehen.
- Der Test-Server läuft auf Port 3100 und nie auf einem schon laufenden Server
  (`reuseExistingServer: false`), damit ihn kein Dev-Server mit echten
  Zugangsdaten ersetzt.

### Neuer Test, neue Migration

Ein neuer Test bekommt sein Konto aus `support/fixtures.ts` (`signedIn`,
`makePro` für den Chat) und räumt es selbst weg. Eine neue Migration braucht
nichts: `supabase start` wendet sie an, und fehlt ihr ein `GRANT`, fällt das hier
auf. Die Tests wurden einmal gegengeprüft, indem je ein Fehler in die App
eingebaut wurde (Projekt-Löschen ohne Speicher-Aufräumen, Export mit internem
Pfad, Schranke gegen schwache Passwörter aus): jeder machte genau den
zuständigen Test rot.

### Datenbank-Typen

Die Spaltennamen aller Abfragen prüft `npm run typecheck` gegen `src/shared/supabase/database.types.ts`. Die Datei ist erzeugt,
nie von Hand ändern. Nach jeder Migration neu schreiben, mit laufendem lokalem Stack und aus der Bash (PowerShell schriebe
UTF-16):

```bash
npx --yes supabase@2.119.0 gen types typescript --local --schema public > src/shared/supabase/database.types.ts
```

Die CLI-Version ist dieselbe wie in `e2e.yml`, dort vergleicht ein Schritt die Datei mit dem Schema aus den Migrationen.
`tests/guards/supabase-types.test.ts` verbietet `.maybeSingle<T>()` und Verwandte, weil sie den erkannten Zeilentyp ersetzen.
Nicht geprüft sind zwei Stellen, die Tabelle und Spalten als Daten führen: `server/account-export.ts` und
`accountsWithRows` in `server/activation-funnel.ts`; dort prüft der Typ nur den Tabellennamen.

## Testabdeckung

`npm run test:coverage` führt dieselben Tests wie `npm run test` mit dem V8-Anbieter
aus (`@vitest/coverage-v8`, Block `coverage` in `vitest.config.ts`), schreibt
`coverage/` (gitignored) und danach eine Tabelle je Verzeichnis
(`scripts/coverage-summary.mjs`, aus Treffern und Gesamtzahlen gerechnet, nicht
aus Mittelwerten). `include` ist `src/**`, damit auch Dateien zählen, die kein Test
lädt. Ein Lauf dauert gut drei Minuten.

**Eine Messung, keine Schranke (#221).** Es gibt keine `thresholds`; die CI wird
von einer Zahl nie rot. Der Job `coverage` in `ci.yml` läuft neben `verify`
(keine längere Wartezeit), seine Schritte dürfen scheitern, der Bericht liegt
14 Tage als Artefakt `coverage` am Lauf, die Tabelle steht in dessen
Zusammenfassung. Eine Ratsche (Zweige je Verzeichnis nicht unter dem Basiswert
minus 2 Punkte) ist die nächste Stufe und eine Entscheidung von Kasum; der
Basiswert steht hier, damit es sie geben kann.

**Basiswert vom 2026-11-01** (240 Testdateien, 3 465 Tests, Windows, Commit
`fd9e84d` plus diese Änderung):

| Verzeichnis | Dateien | Zeilen | Anweisungen | Zweige | Funktionen |
|---|---:|---:|---:|---:|---:|
| `src/server/` | 59 | 92,5 % | 91,0 % | 87,8 % | 90,4 % |
| `src/app/api/` | 20 | 95,4 % | 94,5 % | 90,9 % | 94,6 % |
| `src/app/` (Seiten, ohne api) | 78 | 24,7 % | 24,4 % | 9,5 % | 15,5 % |
| `src/features/` | 114 | 82,0 % | 79,3 % | 74,2 % | 78,7 % |
| `src/shared/` | 80 | 90,8 % | 90,2 % | 86,6 % | 85,9 % |
| `src/shell/` | 13 | 86,9 % | 84,8 % | 80,7 % | 76,6 % |
| Rest (`middleware.ts`, `instrumentation.ts`) | 2 | 70,6 % | 63,2 % | 66,7 % | 33,3 % |
| **Gesamt** | 366 | 83,1 % | 81,6 % | 77,0 % | 76,6 % |

Was die Zahlen sagen und was nicht:

- Für die Bereiche, die Geld, Geheimnisse und Ratenlimit tragen, ist der Basiswert
  hoch (`src/server/` 87,8 %, `src/app/api/` 90,9 % der Zweige). Die Seiten unter
  `src/app/` sind kaum durch Vitest erreicht (Zweige 9,5 %): sie laufen in den
  Browser-Smoketests, die diese Messung nicht sieht.
- Am dünnsten in `src/server/`: `project.ts` (0 von 15 Zweigen), `session.ts` (0 von
  10) und `cli-login/store.ts` (0 von 20) laufen nur gemockt oder über die Browser-Tests, kein
  Vitest-Test führt sie aus.
- Die drei komplexesten Funktionen (Issue #221): `run-chat-turn.ts` 23 von 26 Zweigen
  (seit dem Umbau vom 2026-11-01 kleiner geschnitten), Webhook-Route 56 von 63,
  Gedächtnis-Route 42 von 48. Welche Zweige fehlen, zeigt `vitest run --coverage` mit
  dem Reporter `html` (`--coverage.reporter=html`, danach `coverage/index.html`); sie
  als einzelne Aufgaben aufzunehmen ist der nächste Schritt, aber noch nicht getan.
- V8 misst Zweige aus der Blockabdeckung der Laufzeit, nicht aus dem Quelltext. Ein
  bis zwei Punkte Unterschied zwischen zwei Läufen sind kein Befund (nicht gemessen, wie
  stark sie schwanken), ein Verzeichnis, das um zehn fällt, schon.

## Projektstruktur

Details und Layer-Regeln: [CLAUDE.md](../CLAUDE.md).

```
src/
  app/            NUR Routing. (marketing) = öffentlich, (app) = eingeloggt,
                  (auth) = Login/Signup, api/ = Route-Handler.
  features/       Vertikale Schnitte, je components/ hooks/ lib/:
                  auth · chat · marketing · projects · prompts · settings
  shell/          App-Rahmen (Sidebar, Mobile-Nav, Command-Palette)
  server/         Nie im Browser (`import "server-only"`): security/, brain/,
                  http/, supabase/, llm/, env.ts, byok.ts
  shared/         Von überall nutzbar: ui/ brand/ motion/ providers/ lib/
tests/
  guards/         Repo-weite Invarianten (Kontrast, Schichtgrenzen, Routen, SEO, …)
supabase/
  migrations/     SQL-Schema (RLS, Grants, gehärtete Funktionen)
```

## Projekt-Gedächtnis (AI Project Brain)

Ein Projekt kann Dateien tragen (README, `package.json`, Lockfile, `tsconfig`,
`next.config`, SQL, API-Dokus, Screenshots) und ein öffentliches
GitHub-Repository. Einmal analysieren, und PromptPrinter kennt danach
Framework, Sprache, Architektur, Datenbank, Design-System, Coding-Style und
Konventionen — jeder Chat des Projekts trägt das automatisch mit, der Stack
muss nie wieder erklärt werden.

Der Kern ist die Ökonomie dahinter: die Rohdateien wanderten vorher bei *jedem*
Chat-Zug erneut in den Systemprompt, damit das Modell den Stack jedes Mal aufs
Neue ableitet. Jetzt passiert das einmal, und was mitreist, ist ein
2500-Zeichen-Block. Das Datei-Budget sinkt dadurch von 12000 auf 6000 Zeichen —
unterm Strich weniger Kontext pro Zug bei mehr Wissen.

- Analyse: [`src/server/brain/`](../src/server/brain) (GitHub-Import, Destillation)
- Quellensammlung: [`src/features/projects/lib/brain-sources.ts`](../src/features/projects/lib/brain-sources.ts)
- Injektion: [`src/features/projects/lib/project-context.ts`](../src/features/projects/lib/project-context.ts)
- Route: `POST/DELETE /api/projects/[id]/brain`
- Tabelle: `project_brains` (Migration 0037), bewusst nur mit `select`-Grant —
  geschrieben wird ausschliesslich serverseitig, sonst könnte sich jeder sein
  „analysiertes" Ergebnis aus der Browser-Konsole schreiben.

**GitHub-Kontingent und `GITHUB_TOKEN`.** Der Import braucht zwei Anfragen an
`api.github.com` je Analyse (Metadaten, Dateibaum), die Dateiinhalte kommen vom
Raw-CDN und zählen nicht mit. Ohne Token gilt das Limit von 60 Anfragen pro Stunde
und IP, also 30 Analysen, und auf einer geteilten Server-IP teilen sich alle
Nutzer es (am 05.10.2026 gegen `octocat/Hello-World` und dieses Repository
gemessen: zwei zählende Anfragen je Import, die zehn bis vierzehn Raw-Anfragen
ohne `x-ratelimit`-Header). Mit einem Token ohne Scopes sind es 5000 pro Stunde
(GitHub → Settings → Developer settings → Fine-grained tokens, nur öffentliche
Repositories, keine Berechtigungen), gesetzt als `GITHUB_TOKEN`.

Ob er in Produktion greift, steht im Log: jede Anfrage an `api.github.com` schreibt
`brain.github_quota` mit `authenticated`, `limit` und `remaining` (nie den Token
selbst). Mit Token steht dort `limit: 5000`, ohne `limit: 60`. Ist das Kontingent
aufgebraucht, kommt zusätzlich `brain.github_rate_limited` als Warnung (geht an
den Alarm-Webhook, wenn einer gesetzt ist).

**Keine Embeddings, und das ist eine Entscheidung, kein Rückstand.** Das Gedächtnis
ist ein rund 2 KB großes, destilliertes Artefakt, das ohnehin bei jedem Zug vollständig
mitreist: es gibt nichts zu *finden*, also nichts abzurufen. Die Rohquellen sind auf 20
Dateien plus 14 Repo-Dateien gedeckelt und werden zum Analysezeitpunkt einmal gelesen,
nicht pro Zug durchsucht. pgvector würde eine Extension, einen Embedding-Anbieter
(keiner der vier verdrahteten Anbieter ist dafür angebunden), eine Chunking-Pipeline und
Retrieval-Latenz pro Zug kosten, für ein Korpus, das vollständig ins Budget passt.
**Erst dann neu bewerten,** wenn ein Projekt Quellen tragen soll, die *nicht* mehr
komplett destillierbar sind (ganze Codebasen statt Manifeste, oder Chat-Verläufe als
durchsuchbares Archiv). (Entscheidung vom 2026-08-03, Wortlaut im
[Changelog](CHANGELOG-2026.md), Block "Projekt-Gedächtnis".)

## Anbieter-Ausfall (Failover auf Gemini)

Fällt Z.ai länger aus, ist der Chat für jeden ohne eigenen Key tot, wenn nichts
umschaltet. Mit **beiden** Server-Keys (`ZAI_API_KEY` und `GEMINI_API_KEY`) tut es
[`src/server/llm-failover.ts`](../src/server/llm-failover.ts). Ohne `GEMINI_API_KEY`
bleibt alles wie bisher.

**Wann umgeschaltet wird.** Nur nach den drei Versuchen von `llm-retry.ts`, nur bei
einem Ausfall (Netzabbruch, 408/425/5xx, 429 ohne Guthaben-Text, oder 30 Sekunden
ohne erstes Textstück), nie bei 400/401/403/404/422, leerer Antwort oder
aufgebrauchtem Guthaben (das soll jemand sehen, nicht still auf eine teurere
Rechnung umleiten), nie bei einem Zug mit eigenem Key (BYOK), und bei einem Stream
nur, solange noch kein Textstück beim Nutzer angekommen ist.

**Leistungsschalter.** Drei gescheiterte Züge in Folge innerhalb von zwei Minuten
öffnen ihn (Redis, gilt für alle Instanzen). Dann gehen die Züge 60 Sekunden direkt
zu Gemini, statt erst dreimal gegen den toten Anbieter zu laufen. Danach versucht
ein Zug Z.ai wieder: gelingt er, ist der Schalter zu, scheitert er, ist er sofort
wieder offen. Fällt Redis aus, gilt er als zu (wie bisher zuerst Z.ai).

**Kosten.** Laut Preis-Übersicht (Stand 03.09.2026) kostet `gemini-3.5-flash`
$1,50/$9,00 je Million Tokens gegen $0,20/$1,10 bei `glm-4.5-air`, also etwa das
Achtfache: ein Zug mit 6k rein und 1,5k raus rund $0,0225 statt $0,0029. Darum ein
eigenes Tagesbudget (`LLM_FAILOVER_DAILY_CALLS`, Vorgabe 200 Züge, rund $4,50). Jeder
Zug zählt außerdem weiter einmal gegen Monatskontingent und `LLM_DAILY_CALL_BUDGET`.
Ist das Failover-Budget aufgebraucht, laufen keine Züge mehr auf Gemini.

**Datenschutz.** Im Ausfall gehen Nachrichten, Anhänge und Projektdateien an Google.
Der Key muss deshalb aus einem Projekt mit **aktivierter Abrechnung** stammen: auf
dem Gratis-Tarif darf Google Prompts zur Produktverbesserung nutzen, auf der
bezahlten Stufe nicht (Stand der Gemini-API-Bedingungen 2026-04-28: im EWR, der Schweiz
und Großbritannien gelten die Regeln der bezahlten Stufe für alle Dienste, auch für den
Gratis-Kontingent, außerhalb nicht). **Seit 2026-10-17 nennt die Datenschutzerklärung
Gemini nicht mehr als Ausweich-Anbieter**, weil es keinen `GEMINI_API_KEY` gibt und der
Failover aus ist. Wer den Key wieder setzt, ergänzt vorher in Ziffer 4 (eigener Eintrag) und
Ziffer 5 (USA-Liste) Google Gemini (Google Ireland Ltd. / Google LLC), sonst stimmt der Text
nicht. Wortlaut des früheren Eintrags: Git-Verlauf von `datenschutz/page.tsx`, Stand
2026-10-15. Ob die Formulierung alle Fälle trägt (Anhänge, Projektdateien), sollte
juristisch angesehen werden.

**Was du im Log siehst.** `llm.retry` (jeder Wiederholungsversuch), `llm.failover`
(Warnung, geht an den Alarm-Webhook: `from`, `to`, `reason`, `attempts`),
`llm.breaker_open` (Warnung) und `llm.breaker_closed`,
`spend_guard.failover_budget_exhausted` (Warnung). `chat.turn` und
`chat.turn_failed` tragen den Anbieter, auf dem der Zug WIRKLICH lief (`provider`).

**Zeitlimit.** Der Z.ai-Stream hat jetzt ein Zeitlimit bis zum ersten Textstück
(30 Sekunden, `ZAI_FIRST_CHUNK_TIMEOUT_MS` in `llm/zai.ts`). Vorher hatte er keines: ein
hängender Anbieter blockierte den Zug bis zur `maxDuration` der Route (300
Sekunden). Das gilt auch ohne Gemini-Key; danach läuft ein Stream beliebig lange.

**Aktivieren.** `GEMINI_API_KEY` (bezahlte Stufe) in Vercel setzen, neu deployen.
Ohne Key tut der Code nichts. Geprüft ist er mit simulierten Ausfällen
(`llm-failover.test.ts`, `llm.test.ts`), **nicht** gegen den echten Gemini-Dienst.

## Anhänge im Chat

Ein „+" im Composer hängt Fotos (PNG, JPG, WebP) und Text-, Code- oder
Konfigurationsdateien an eine Nachricht, bis zu vier. Die Anhänge bleiben im Chat
und gehen bei späteren Antworten erneut mit, soweit sie ins Modell-Budget passen.

- Grenzen an einer Stelle: [`src/shared/lib/chat-limits.ts`](../src/shared/lib/chat-limits.ts)
- Prüfen, ablegen, nachschlagen: [`src/features/chat/lib/attachment-store.ts`](../src/features/chat/lib/attachment-store.ts)
- Was beim Modell ankommt (Budget, Kürzen): [`attachment-model.ts`](../src/features/chat/lib/attachment-model.ts), [`model-history.ts`](../src/features/chat/lib/model-history.ts)
- Tabelle `message_attachments` und privater Bucket `chat-attachments`: **Migration 0045**.
  Der Bucket hat bewusst **keine insert-Policy**, geschrieben wird nur in `/api/chat`
  über den Service-Role-Client, nachdem Magic Bytes, Kodierung, Grössen und das
  Speicherkontingent (100 MB je Konto) geprüft sind.
- **Reihenfolge beim Deploy: erst Migration 0045 anwenden, dann den Code.** Läuft
  der Code ohne die Migration, geht der Chat weiter (Verlauf ohne Anhänge), aber
  jede Nachricht MIT Anhang scheitert mit "konnte nicht gespeichert werden".
- Z.ai: ein Zug, dessen Verlauf ein Bild trägt, läuft auf dem sehenden Modell
  (`ZAI_VISION_MODEL`, Default `glm-4.6v`) statt auf `glm-4.5-air`. Teurer, aber nur
  für Züge mit Bild.
- Verwaiste Objekte im Bucket (ein Aufräumschritt, der nach dem Löschen scheiterte):
  `node scripts/reconcile-project-files-storage.mjs --bucket=chat-attachments`

## Geschwindigkeitsmessung (Vercel Speed Insights)

`<SiteSpeedInsights />` im Root-Layout ([`src/shared/providers/site-speed-insights.tsx`](../src/shared/providers/site-speed-insights.tsx))
misst die Ladezeiten (Web Vitals) echter Besucher, auf den öffentlichen Seiten
genauso wie in der App. Es braucht keinen Env-Wert und keinen Schalter im Dashboard:
das Paket `@vercel/speed-insights` hängt das Skript an, Vercel stellt
`/_vercel/speed-insights/*` selbst bereit. Ansehen: Vercel → Projekt → **Speed Insights**.

- **Nur im Produktions-Build.** In `npm run dev` und `npm run test:e2e` lädt das Paket
  ein Debug-Skript von `va.vercel-scripts.com`, das die CSP zu Recht blockiert.
  Vorschau-Deployments auf Vercel sind Produktions-Builds, dort ist die Komponente drin.
- **Adressen werden vor dem Senden gekürzt** ([`speed-insights-event.ts`](../src/shared/lib/speed-insights-event.ts)):
  Das Skript schickt `location.href`. Query und Fragment fallen weg (Anmeldelinks
  hängen Einmalwerte an), jede UUID im Pfad wird zu `[id]` (`/chats/<uuid>` →
  `/chats/[id]`).
- **Keine CSP-Änderung**: Skript und Messwerte laufen über `'self'`. Stellt jemand
  `scriptSrc` oder `endpoint` auf einen fremden Host, muss `csp.ts` mitziehen, ein
  Test in `csp.test.ts` erinnert daran.
- **Kosten**: kostenlos auf allen Tarifen, 10.000 Ereignisse in 30 Tagen. Wird die
  Grenze erreicht, pausiert Vercel die Messung für mindestens 14 Tage, es gibt keine
  Rechnung. Der kostenlose Tarif zeigt nur den Real Experience Score und Zähler je
  Seite. Alle Core Web Vitals (LCP, INP, CLS, FCP, TTFB) gibt es erst mit Speed
  Insights Plus (nur Pro, 10 $ je Projekt und Monat plus Ereignisse). Stand der
  Vercel-Dokumentation vom 06.10.2026. Mit `sampleRate` an `<SpeedInsights />` lassen
  sich weniger Ereignisse senden.
- **Datenschutz**: genannt in der Datenschutzerklärung (Ziffern 2, 3, 4, 6) und auf
  `/cookies` (Ziffer 3). Ändert sich, was gesendet wird, beide Texte mitziehen.
- **Nicht dasselbe wie Web Analytics** (`@vercel/analytics`, Besucherzahlen und
  Herkunft). Das ist nicht eingebaut und in den Rechtstexten nicht genannt, siehe in
  `CLAUDE.md`, "Arbeitsregeln", den Punkt zu den Dependabot-PRs (Vercel-Bot-Branch).
