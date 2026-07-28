# Docker, PromptPrinter starten & stoppen

**Voraussetzung:** Docker Desktop muss **laufen** (Wal-Icon unten rechts ruhig/grün).
Prüfen:

```powershell
docker info
```

Wenn das einen Fehler gibt → Docker Desktop öffnen und warten, bis es gestartet ist.

---

## Entwicklung, der Ersatz für `npm run dev` (mit Hot-Reload)

```powershell
npm run docker:dev
```

Prüft zuerst, ob `.env.local` alle Pflichtvariablen trägt (`scripts/check-env.mjs`,
sieht das Kommando davor), und startet erst danach den Container. Ohne den Check
kam der Fehler bisher erst nach dem Start, als 429 auf jede API-Route (siehe
`src/lib/env.ts`s Boot-Check für dieselbe Prüfung im Next-Prozess selbst).
Direkt ohne Prüfung: `docker compose -f docker-compose.dev.yml up`

- App läuft auf **http://localhost:3000**
- Code-Änderungen laden **automatisch neu** (Hot-Reload, der Quellcode ist in den Container gemountet)
- Liest deine **`.env.local`**
- Erster Start dauert etwas (lädt `node:22` und installiert die Abhängigkeiten im Container, danach gecacht)

**Stoppen:** im selben Terminal **`Strg + C`**, danach sauber aufräumen:

```powershell
docker compose -f docker-compose.dev.yml down
```

Im Hintergrund starten: `... up -d` · Logs ansehen: `docker compose -f docker-compose.dev.yml logs -f`

---

## Produktion, gebautes Image (wie es deployed würde)

```powershell
npm run docker:prod
```

- App läuft auf **http://localhost:3001**
- Baut das optimierte **Standalone-Image** und startet `node server.js` als Non-Root-User
- `--env-file .env.local` sorgt dafür, dass die `NEXT_PUBLIC_*`-Werte beim Build mit eingebacken werden (sie landen im Client-Bundle)
- Prüft vorher **beide** Dateien (`.env` für die Container-Laufzeit über `env_file`,
  `.env.local` für die `NEXT_PUBLIC_*`-Build-Args), das ist die Falle aus
  CLAUDE.md: zwei verschiedene Dateien für zwei verschiedene Mechanismen, eine
  davon zu vergessen fiel bisher erst nach dem Start auf.

Direkt ohne Prüfung: `docker compose --env-file .env.local up --build -d`

**Stoppen:**

```powershell
docker compose down
```

Nach Code-Änderungen neu bauen: denselben `up --build`-Befehl nochmal.

---

## Spickzettel

| Was | Befehl |
|---|---|
| Dev starten (mit Env-Check) | `npm run docker:dev` |
| Dev stoppen | `Strg + C`, dann `docker compose -f docker-compose.dev.yml down` |
| Prod starten (mit Env-Check) | `npm run docker:prod` |
| Prod stoppen | `docker compose down` |
| Env-Dateien allein prüfen | `node scripts/check-env.mjs dev` bzw. `... prod` |
| Laufende Container | `docker ps` |
| Logs (Dev) | `docker compose -f docker-compose.dev.yml logs -f` |
| Container + Volumes löschen | `docker compose -f docker-compose.dev.yml down -v` |

---

## Hinweis zu `npm run dev`

`npm run dev` bleibt vorhanden, der **Dev-Container ruft es intern selbst auf**, deshalb darf es nicht entfernt werden. Dein Workflow ist jetzt aber **ein Docker-Befehl** statt npm direkt:

```powershell
docker compose -f docker-compose.dev.yml up
```

Solange der Container läuft, brauchst du `npm run dev` auf dem Host nicht mehr.

> **Falls noch ein altes `npm run dev` auf Port 3000 hängt** und Docker den Port nicht
> binden kann: `npx kill-port 3000` (oder `Strg + C` im alten Terminal).
