# REDESIGN.md — Das Workspace-Modell (verbindlich)

> Beschlossen am 2026-07-02. Dieses Dokument ist die verbindliche Grundlage für den
> Produktumbau (Phasen 1–5, siehe unten). Bei Widersprüchen zwischen diesem Dokument
> und IST-Beschreibungen (CLAUDE.md, README.md) gilt dieses Dokument. Die Phasen
> werden einzeln umgesetzt, jede endet shippbar mit grünem Quality-Gate.

## 0. Beschlossene Grundsatzentscheidungen

1. **„Start" entfällt als Nav-Punkt.** Die Hauptnavigation besteht aus den zwei
   echten Arbeitsorten: **Chats** und **Projekte**. Login führt in einen
   Arbeitszustand (neuer Chat), nicht in einen Überblicksraum.
2. **Der Mode-Split ist auf Projektebene aufgelöst.** Ein Projekt ist ein
   Workspace — kein `general`- oder `software`-Projekt mehr im Produktverständnis.
   Ob darin Alltags-Prompts oder Software-Pakete entstehen, ist eine Frage der
   Aktionen und Ergebnistypen, nicht der Projektstruktur. `projects.type` bleibt
   technisch für Bestandsdaten bestehen, bestimmt aber kein Nutzerverständnis mehr.
3. **Projekt-Chats sind echte Subrouten** (`/projects/[id]/chats/[cid]`) —
   technisch eigene URL, gestalterisch derselbe Raum: die Workspace-Shell
   (Header + Kontext-Rail) bleibt beim Navigieren stehen, nur die Hauptspalte
   wechselt ihren Zustand.

## 1. Zielmodell

**Chats sind das Arbeiten, Projekte sind das Zuhause fürs Arbeiten.**

- Ein **Projekt** ist ein Container, der direkt anlegbar ist (nur ein Name nötig)
  und über die Zeit wächst: Anweisungen (Briefing), Struktur (optionale
  Technik-Felder), Dateien, mehrere Chats, Ergebnisse (Artefakte + Verlauf).
- **Globale Chats** bleiben der freie Raum — schnell, ohne Setup. Ein guter Chat
  kann nachträglich in ein Projekt einziehen.
- **Projekt-Chats** erben automatisch Anweisungen + Struktur + Dateien als Kontext.
- **„Paket bauen"** und **„Prompt speichern"** (heute `/api/generate`) sind
  Aktionen *im* Projekt — nicht mehr die Geburt des Projekts. Sie können mehrfach
  laufen; jedes Ergebnis landet im Ergebnisse-Bereich.
- Das Projekt entsteht am **Anfang** der Arbeit (oder mittendrin, per Handoff aus
  einem Chat) — nie mehr nur als eingefrorenes Endprodukt.

## 2. Sidebar-Konzept

Die Sidebar ist ein zentrales Produktelement, keine Linkliste.

**Zustände:**
- `expanded` (~264px) / `collapsed` (~72px Icon-Rail).
- Toggle-Button im Sidebar-Kopf + Tastenkürzel `Ctrl/⌘+B`.
- Zustand in einem Cookie persistiert, damit SSR die richtige Breite rendert
  (kein Layout-Flash beim Laden).
- Animation: ruhige Width-Transition (~250ms, weiche Kurve), Labels faden/gleiten;
  `prefers-reduced-motion` → sofortiger Wechsel. Framer Motion, Finn-weich,
  „felt, not seen".
- Mobile: bestehendes Drawer-Muster, bekommt dieselbe Inhaltsstruktur.

**Inhalt (expanded, von oben nach unten):**
1. Logo + Collapse-Toggle
2. **Neuer Chat** (Primäraktion → `/chats/new`)
3. Sektion **Chats**: die ~5 zuletzt aktiven *globalen* Chats, direkt klickbar,
   darunter „Alle Chats" (→ `/chats`)
4. Sektion **Projekte**: gepinnte zuerst (nutzt vorhandenes `is_favorite`), dann
   zuletzt aktive, max. ~5; darunter „Alle Projekte" (→ `/projects`) und
   „Neues Projekt" (öffnet den Anlege-Dialog)
5. Footer: Einstellungen, Abrechnung, User

**Collapsed:** nur Icons (Neuer Chat, Chats, Projekte, Einstellungen) mit Tooltips
und aktiven Zuständen. Recents sind im collapsed-Zustand nicht einzeln sichtbar.

**Daten:** Server-seitig im App-Layout geladen (Recents + Pins); nach Mutationen
(Chat erstellt, Projekt angelegt/gepinnt) `router.refresh()`. Aktiv-Zustand über
Pathname.

Die Sidebar ersetzt funktional: den Dashboard-Resume („wo mache ich weiter?")
und die Featured-Chat-Karte auf `/chats`.

## 3. Chats-Konzept

- **Ein Chat, keine Modus-Wahl beim Start.** Die Headline-Trennung
  „Alltags-Prompt / Software-Projekt" entfällt. Das Assistenten-Verhalten
  adaptiert aus dem Kontext: global = universeller Prompt-Engineer; im Projekt
  = plus injizierter Projektkontext. `conversations.mode` bleibt intern für
  Bestandsdaten bestehen, hat aber keine UI mehr.
- `/chats` listet nur **globale** Chats (`project_id is null`). Projekt-Chats
  leben ausschließlich in ihrem Projekt. Klares mentales Modell: Chats = freier
  Raum, Projekte = Arbeitsräume.
- **Neuer Chat** (`/chats/new`): Finn-Empty-State + Starter + Composer. Nach dem
  ersten persistierten Turn wechselt die URL per `router.replace` auf die
  kanonische `/chats/[id]`. Gleiches Muster im Projekt.
- **Aktionen pro Chat:** öffnen, umbenennen, löschen. „In Projekt verschieben"
  (setzt `project_id` nachträglich, Chat wird Projekt-Chat) ist bewusst
  **nicht** Teil von Phase 5 — sauber umsetzbar, aber ein eigener kleiner
  Funktionsblock (Projekt-Picker-UI, Empty-State „noch kein Projekt"), kein
  Copy-Fix. Als eigener Nachschritt vorgemerkt, siehe Abschnitt 9.
- **Handoff-Modell final (Wahrheits-Pass, 2026-07-03):** Die ursprünglich
  geplante Verschmelzung von `PacketBridge`/`PromptSave` zu einer Karte mit
  drei Optionen (Prompt speichern | Paket bauen | nur Projekt anlegen) ist
  durch die tatsächliche Umsetzung überholt, nicht offen:
  „nur Projekt anlegen" existiert bereits sauberer als der direkte
  „Neues Projekt"-Dialog (Phase 3, kein Chat-Umweg nötig); Chat-Handoff bleibt
  eine schlanke Zwei-Knopf-Leiste am Chat-Ende („Software-Paket erzeugen" /
  „Prompt erzeugen"), die direkt die passende Karte öffnet — dasselbe Modell
  (ein Handoff-Moment, zwei Ergebnistypen), nur ohne unnötige dritte Option.
  `PacketBridge` und `PromptSave` bleiben bewusst zwei Dateien: die geteilte
  Logik (Prefill, Workspace- vs. Standalone-Ziel, Redirect) ist klein genug,
  dass ein Merge nur Bedingungslogik einführen würde, ohne das Modell klarer
  zu machen — beide Komponenten wurden in Phase 4 gerade erst live verifiziert.

## 4. Projekt-Workspace-Konzept

**Anlegen:** per Dialog (nur Name), aus Sidebar oder Projektliste. Kein
Generierungszwang. Redirect direkt in den neuen Workspace.

**Shell (bleibt über alle Unterzustände stehen):**
- Header: Projektname, Pin, Meta (Chats/Dateien/Ergebnis-Stand), Löschen.
- **Kontext-Rail** (rechts, auf Mobile gestapelt):
  - **Anweisungen** — editierbares Freitext-Briefing („Wie soll dein Prompt
    aussehen? Ton, Format, Ziel-KI…"), Autosave. Fließt voll in jeden
    Projekt-Chat.
  - **Struktur** — optionale Felder als Chips: Frontend, Backend, Sprache,
    Datenbank/Supabase, Eigenes. Ersetzt die vier eingefrorenen
    Bridge-Dropdowns. Gespeichert in `projects.context` (jsonb).
  - **Dateien** — Upload (Phase 4). Hinweis: „Am besten `.md` —
    token-effizient." Allowlist `.md/.txt/.json/.csv`, max. 10 Dateien à
    200 KB. Bewusst nur Textformate: sie werden direkt in den Kontext
    injiziert.
  - **Ergebnisse-Karte** — Kurzstatus + Link auf den Ergebnisse-Zustand.

**Hauptspalte (wechselt per Subroute):**
- **Übersicht** (`/projects/[id]`): Composer „Neuer Chat in diesem Projekt"
  oben, darunter die Chat-Liste des Projekts.
- **Chat** (`/projects/[id]/chats/[cid]`): der geöffnete Projekt-Chat,
  Rückweg zur Liste.
- **Ergebnisse** (`/projects/[id]/results`): die Artefakt-Ansicht (heutige
  Tabs, gerendert je Ergebnistyp) + Verlauf + Aktionen „Paket bauen" /
  „Prompt speichern".

**Ergebnistypen:** Ein `/api/generate`-Lauf erzeugt ein Ergebnis. Zwei Typen:
**Prompt-Paket** (Software, 10 Artefakte) und **Prompt** (Haupt-Prompt + 3
Varianten). Der Typ wird aus der `outputs`-Form abgeleitet (`master`-Key =
Paket, `prompt`-Key = Prompt) — kein neues Schemafeld nötig. Alt-Projekte
beider Typen rendern damit unverändert korrekt als Workspaces.

**Limits:** Das Projekt-Limit (Free: 3) gilt künftig beim *Anlegen* des
Workspace. Das Generierungs-Limit bleibt unverändert an `/api/generate`.

## 5. URL-/Routing-Konzept

| Route | Inhalt |
|---|---|
| `/chats` | Alle globalen Chats (Liste) |
| `/chats/new` | Neuer Chat — **Login-Landing** |
| `/chats/[id]` | Ein globaler Chat (kanonische URL) |
| `/projects` | Projektliste |
| `/projects/[id]` | Workspace-Übersicht (Composer + Chat-Liste + Rail) |
| `/projects/[id]/chats/[cid]` | Projekt-Chat, dieselbe Shell |
| `/projects/[id]/results` | Ergebnisse + Verlauf, dieselbe Shell |

**Redirects (Alt-Links bleiben heil):**
- `/dashboard` → `/chats/new` (übergangsweise `/chats`, bis `/chats/new` existiert)
- `/chat` → `/chats/new`; `/chat?id=X` → `/chats/X`
- `/library`, `/generations` → `/projects` (bestehen bereits)

**Technisches Shell-Konzept:** `(app)/projects/[id]/layout.tsx` lädt das Projekt
und rendert Header + Rail; `page.tsx` (Übersicht), `chats/[cid]/page.tsx` und
`results/page.tsx` sind Kinder. Das Layout persistiert über Navigationen —
die Rail baut sich nicht neu auf, der Wechsel fühlt sich wie ein Zustandswechsel
desselben Raums an, nicht wie ein Seitenwechsel. Übergänge der Hauptspalte weich
animiert, reduced-motion-safe.

**Middleware/Login:** Redirect-Ziel nach Login wechselt von `/dashboard` auf
`/chats/new`.

## 6. Datenmodell-Änderungen

**Migration 0011 (Phase 3):**
- `projects.instructions text` (Briefing)
- `projects.context jsonb not null default '{}'` (Struktur-Felder)
- `audience`, `idea`, `tools` nullable machen (leere Projekte müssen existieren
  dürfen)
- `type`, `status`, `is_favorite` unverändert (`is_favorite` = Sidebar-Pin)

**Migration 0012 (Phase 4):**
- Tabelle `project_files` (id, project_id, user_id, name, storage_path, mime,
  size_bytes, created_at) — RLS owner-scoped, Grants explizit, Stil wie 0009
- Storage-Bucket `project-files`, Policies owner-scoped wie beim Avatar-Bucket

**Unverändert:** `conversations` (hat `project_id` bereits; Umbenennen deckt die
`for all`-Policy ab), `messages`, `generations`.

## 7. Kontext-Injektion v2 (`buildProjectContext`)

Reihenfolge und Budget (ersetzt die heutige 1200-Zeichen-Idea):
1. **Anweisungen** — voll, hart gekappt bei ~4.000 Zeichen
2. **Struktur** — kompakte `Key: Value`-Zeilen
3. **Dateien** — `.md` zuerst, Gesamtbudget ~24.000 Zeichen, pro Datei gekappt;
   nicht injizierte Dateien werden namentlich erwähnt
4. **Neuestes Ergebnis** — Haupt-Artefakt gekürzt (~2.400 Zeichen, wie heute)

Anweisungen stehen bewusst zuerst: das Briefing des Nutzers schlägt alles andere.

## 8. Streichliste — was ehrlich weg muss

- **`/dashboard` komplett** (Resume-Hero, Favoriten, Stats, Start-Finn-Raum) →
  Redirect. Das betrifft bewusst Arbeit aus der „Finn-Räume"-Session.
- **Featured-Chat-Karte auf `/chats`** — die Sidebar übernimmt Resume.
- **Jede Modus-Wahl-UI**: Chat-Headlines („Alltags-Prompt"/„Software-Projekt"),
  Einstiegs-Karten, `?mode=`-Links.
- **Refine-Chat-Anhängsel** unter den Projekt-Tabs → geht in Projekt-Chats auf.
- **Die vier Tool-Dropdowns im Bridge-Modal** → Struktur-Felder im Workspace.
  Die Settings-„Tool-Defaults" werden in Phase 3 zu Struktur-Defaults umgebaut
  oder gestrichen.
- **`tool-group.tsx`** (totes Duplikat) — löschen.
- **Landing nachziehen (Phase 5):** ProductShowcase und die Pricing-Zeile
  zeigen die 3er-Nav mit „Start" — werden erneut überholt.
- **Finn-Rollen wandern:** Start-Raum-Finn entfällt; `curious` →
  Neuer-Chat-Home, `listening` → Chats, `building`/`delivering` →
  Workspace/Ergebnisse.
- **CLAUDE.md-IST-Beschreibungen** werden je Phase nachgezogen.

## 9. Umsetzungsphasen (verbindlich)

Jede Phase: eigenes Konzept-Feintuning falls nötig → Umsetzung → Quality-Gate
(`typecheck && lint && test && build`) → Commit(s) + Push.

**Phase 1 — Sidebar & Nav-Reduktion**
- Neue Sidebar: expand/collapse (Cookie, `Ctrl/⌘+B`, Animation,
  reduced-motion), Recents (Chats + Projekte mit Pins), „Neuer Chat", Footer.
- Nav wird zweigliedrig (Chats/Projekte); `/dashboard` → Redirect auf `/chats`.
- Mobile-Drawer + Command-Palette auf die neue Nav.
- **DoD:** Sidebar SSR-korrekt in beiden Zuständen; alle Routen erreichbar;
  Gate grün.

**Phase 2 — Chat-Kanonisierung & Login-Landing**
- `/chats/new` + `/chats/[id]`; `/chat`-Redirects (`?id=` wird umgeschrieben);
  Login-Landing → `/chats/new`; `router.replace` nach erstem Turn;
  `/chats`-Liste verschlankt (Featured raus, Umbenennen/Löschen); Modus-UI raus.
- **DoD:** Alt-Link `/chat?id=X` landet korrekt; neuer Chat bekommt kanonische
  URL; Gate grün.

**Phase 3 — Workspace v1**
- Migration 0011; „Neues Projekt"-Dialog; Workspace-Shell (`layout.tsx`) mit
  Header + Rail (Anweisungen mit Autosave, Struktur-Chips); Übersicht mit
  Composer + Chat-Liste; Subrouten `chats/[cid]` und `results` (Tabs + Verlauf
  ziehen um); `buildProjectContext` v2 (ohne Dateien); Projektliste zeigt
  Workspace-Meta.
- **DoD:** Leeres Projekt anlegbar; zweiter Chat im selben Projekt möglich;
  Alt-Projekte beider Typen rendern korrekt; Gate grün.

**Phase 4 — Dateien**
- Migration 0012 + Bucket; Upload/Löschen in der Rail (Allowlist, Limits,
  `.md`-Hinweis); Kontext-Injektion mit Budget.
- **DoD:** Upload + Löschen funktionieren; Dateiinhalt nachweislich im
  Chat-Kontext; Limits greifen; Gate grün.

**Phase 5 — Handoff & Wahrheits-Pass**
- ~~Einheitliche Handoff-Komponente~~ — per Wahrheits-Pass-Entscheidung
  (Abschnitt 3) bewusst **nicht** zusammengeführt; das Modell ist bereits
  klar, ein Merge hätte nur Bedingungslogik eingeführt.
- ✅ „Paket bauen"/„Prompt erzeugen" als Aktion im Workspace — umgesetzt als
  Chat-Handoff-Leiste (jeder Projekt-Chat kann direkt erzeugen, landet in
  Ergebnisse); bewusst kein zusätzlicher Erzeugen-Button auf der
  Ergebnisse-Seite selbst — der Chat bleibt der eine Auslöseort.
- ✅ Copy-Pass durch die App (Settings-Tool-Defaults-Text, tote
  `ProjectCard`-Komponente, stale Code-Kommentare) und Landing
  (`ProductShowcase`: keine „Start"-Nav, keine Modus-Badges mehr) erledigt.
- ⏳ **„In Projekt verschieben"** für bestehende globale Chats — bewusst als
  eigener Nachschritt ausgeklammert (siehe oben), kein Teil dieser Runde.
- ✅ Pricing-Zeile geprüft — bereits sauber („Chats & Projekte" als Feature,
  kein Start/Modus-Rest), kein Fix nötig.
- ⏳ `tool-group.tsx` (bereits gelöscht, siehe frühere Phase), Settings-
  Defaults-Grundsatzfrage (behalten vs. streichen) — niedrige Priorität,
  kein bekannter Bruch, bewusst liegen gelassen.
- **DoD:** Kein UI-Text verweist mehr auf Start oder Modus-Projekte in App
  und Landing-Nav; Gate grün. Erfüllt.

## 10. Nicht-Ziele (bewusst später oder nie)

- BYOK-Backend (bleibt vorerst Positionierung)
- Lemon-Squeezy-Integration (erst nach Hosting)
- Nicht-Text-Dateien (PDF, Bilder) — ohne echten API-Key totes Gewicht
- Chat-Volltextsuche (später, wenn Datenmenge es rechtfertigt)
- Team-/Kollaborations-Features
- Ergebnisse zwischen Projekten verschieben
