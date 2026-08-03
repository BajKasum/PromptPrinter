# Docker, PromptPrinter starten & stoppen

**Voraussetzung:** Docker Desktop muss **laufen** (Wal-Icon unten rechts ruhig/grün).
Prüfen:

```powershell
docker info
```

Wenn das einen Fehler gibt → Docker Desktop öffnen und warten, bis es gestartet ist.

---

> ⚠️ **`docker-compose.yml` ist seit 2026-08 der Dev-Stack, nicht mehr Prod.**
> Der blanke Befehl `docker compose up --build` (ohne `-f`) baute vorher
> stillschweigend das strikte Produktions-Image, das ohne Upstash/
> Verschlüsselungs-Secret mit `[env] ... erforderliche Umgebungsvariable(n)
> fehlen` beim Boot abbrach — ein Dev-Rechner trägt diese Secrets normalerweise
> nicht. Jetzt ist es umgekehrt: der blanke Befehl startet Dev, Produktion
> braucht zwingend `-f docker-compose.prod.yml`, das kann nicht aus Gewohnheit
> passieren.

## Entwicklung, der Ersatz für `npm run dev` (mit Hot-Reload + Turbopack)

```powershell
npm run docker:dev
```

Prüft zuerst, ob `.env.local` die Pflichtvariablen für Dev trägt
(`scripts/check-env.mjs`, sieht das Kommando davor — nur Supabase + App-URL,
siehe unten warum), und startet erst danach den Container. Ohne den Check
kam der Fehler bisher erst nach dem Start.
Direkt ohne Prüfung: `docker compose up --build` (das ist jetzt derselbe
Befehl, den der blanke `docker compose up --build` sowieso ausführt —
`docker-compose.yml` ohne `-f` ist der Dev-Stack).

- App läuft auf **http://localhost:3000**
- Code-Änderungen laden **automatisch neu** (Hot-Reload via Turbopack, der
  Quellcode ist in den Container gemountet)
- Liest deine **`.env.local`**
- `--build` baut jetzt wirklich etwas: das Dockerfile hat einen eigenen
  `dev`-Build-Target (installiert Abhängigkeiten in einer gecachten Schicht,
  genau wie der Produktions-Build). Erster Start dauert etwas, jeder folgende
  ist schnell, solange sich `package-lock.json` nicht ändert.
- Braucht **kein** `UPSTASH_REDIS_REST_URL`/`_TOKEN` und kein
  `API_KEY_ENCRYPTION_SECRET` mehr: `src/lib/rate-limit.ts` fällt ausserhalb
  von Produktion auf einen In-Memory-Limiter zurück, `src/lib/crypto.ts` auf
  einen festen, klar als unsicher markierten Dev-Schlüssel (Konsolen-Warnung
  macht das sichtbar). Beides nur ausserhalb `NODE_ENV=production` aktiv, in
  Produktion bleibt es beim strikten Verhalten.

**Stoppen:** im selben Terminal **`Strg + C`**, danach sauber aufräumen:

```powershell
docker compose down
```

Im Hintergrund starten: `... up -d --build` · Logs ansehen: `docker compose logs -f`

---

## Produktion, gebautes Image (wie es deployed würde)

```powershell
npm run docker:prod
```

- App läuft auf **http://localhost:3001**
- Baut das optimierte **Standalone-Image** (Dockerfile-Target `runner`) und
  startet `node server.js` als Non-Root-User
- `--env-file .env.local` sorgt dafür, dass die `NEXT_PUBLIC_*`-Werte beim Build
  mit eingebacken werden (sie landen im Client-Bundle)
- Prüft vorher **beide** Dateien (`.env` für die Container-Laufzeit über
  `env_file`, `.env.local` für die `NEXT_PUBLIC_*`-Build-Args), das ist die
  Falle aus CLAUDE.md: zwei verschiedene Dateien für zwei verschiedene
  Mechanismen, eine davon zu vergessen fiel bisher erst nach dem Start auf.
- Bleibt **strikt fail-closed**, unveraendert: fehlt eine Pflichtvariable
  (Supabase, `API_KEY_ENCRYPTION_SECRET`, beide `UPSTASH_*`), bricht der Start
  ab statt in einem funktional toten Zustand hochzukommen.

Direkt ohne Prüfung: `docker compose -f docker-compose.prod.yml --env-file .env.local up --build -d`

**Stoppen:**

```powershell
docker compose -f docker-compose.prod.yml down
```

Nach Code-Änderungen neu bauen: denselben `up --build`-Befehl nochmal.

---

## Spickzettel

| Was | Befehl |
|---|---|
| Dev starten (mit Env-Check) | `npm run docker:dev` |
| Dev stoppen | `Strg + C`, dann `docker compose down` |
| Prod starten (mit Env-Check) | `npm run docker:prod` |
| Prod stoppen | `docker compose -f docker-compose.prod.yml down` |
| Env-Dateien allein prüfen | `node scripts/check-env.mjs dev` bzw. `... prod` |
| Laufende Container | `docker ps` |
| Logs (Dev) | `docker compose logs -f` |
| Container + Volumes löschen (Dev) | `docker compose down -v` |

---

## Hinweis zu `npm run dev`

`npm run dev` bleibt vorhanden, der **Dev-Container ruft es intern selbst auf**
(`next dev --turbopack`), deshalb darf es nicht entfernt werden. Dein Workflow
ist jetzt aber **ein Docker-Befehl** statt npm direkt:

```powershell
docker compose up --build
```

Solange der Container läuft, brauchst du `npm run dev` auf dem Host nicht mehr.

> **Falls noch ein altes `npm run dev` auf Port 3000 hängt** und Docker den Port nicht
> binden kann: `npx kill-port 3000` (oder `Strg + C` im alten Terminal).
