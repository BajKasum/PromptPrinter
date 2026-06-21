# PromptPrinter — Maskottchen-System („Finn der Delfin")

> **Ziel:** Der Delfin ist kein Deko-Element mehr, sondern der **Produkt-Guide
> und Marken-Charakter** von PromptPrinter — auf einer Ebene mit Duolingos Owl,
> GitHubs Octocat und Mailchimps Freddie. Der Besucher soll fühlen: *„Ich werde
> geführt"* statt *„Ich lese eine Landingpage"*.
>
> **Status dieses Dokuments:** Spezifikation & Architektur. **Noch keine Assets
> generiert.** Die Asset-Produktion (Higgsfield o. Ä.) folgt als nächster Schritt
> auf Basis dieser Spec.

Verwandt: [DESIGN.md](DESIGN.md) (Tokens, Motion-Regeln), `[[project-dolphin-mascot-states]]`.

---

## 1. Der Charakter

### Name: **Finn**

Ein Mensch erinnert sich an *Duo*, *Octocat*, *Freddie* — nicht an „das
Eulen-Logo". Ein Name macht das Maskottchen zitierbar („Frag Finn", „Finn baut
das für dich"). Empfehlung: **Finn** — Flossen-Wortspiel, funktioniert in DE & EN,
freundlich, kurz, merkbar.

Alternativen, falls gewünscht:
- **Echo** — konzeptionell stark (Delfine nutzen Echolokation; PromptPrinter wirft
  deine Idee strukturiert zurück), Risiko: Verwechslung mit Amazon Echo.
- **Pip** — verspielt, „P" wie PromptPrinter.
- **Marlo** — eigenständig, charmant.

> Der Rest des Dokuments verwendet **Finn** als Arbeitsnamen. Ein Find-&-Replace
> reicht, falls die Wahl anders ausfällt.

### Persönlichkeit

| Eigenschaft | So ist Finn | So ist Finn **nicht** |
|---|---|---|
| Tonfall | freundlich, ruhig, kompetent | aufdringlich, kindisch |
| Rolle | erfahrener Bau-Buddy an deiner Seite | belehrender Lehrer, nerviger Clippy |
| Sprache | „du", knapp, ein Hauch Humor | Fachjargon, Walltext, Emoji-Spam |
| Auftritt | erscheint **wenn er hilft**, tritt dann zurück | ständig im Weg, blockiert Inhalt |
| Stil | passt zur Marke (Linear/Vercel-clean) | Cartoon-Overload |

**Goldene Regel:** Finn verstärkt den Inhalt, er ersetzt ihn nie. Pro
Viewport **maximal ein** Finn. Nie zwei Finns gleichzeitig sichtbar.

---

## 2. Ist-Zustand (Audit)

### Vorhandene Assets (`/public/mascot/`)
| Datei | Ausdruck | heute genutzt für |
|---|---|---|
| `dolphin.png` | neutral | Logo / Wordmark, Chat-Empty-State, Loader |
| `dolphin-happy.png` | fröhlich | Hero, Example-Output, Final-CTA, Erfolg, Toast-Success |
| `dolphin-sad.png` | traurig | Problem, Error-Pages, 404, Auth-Expired, Toast-Error |
| `dolphin-think.png` | Bauhelm + Werkzeug | How-It-Works |

### Vorhandene Maskottchen-Infrastruktur (wiederverwenden!)
- `src/components/brand/mascot.tsx` — Basis-Komponente (`<Mascot src size alt priority>`), via `next/image`.
- `src/components/brand/logo.tsx` — Lockup Delfin + Wordmark, plus `LogoMark`.
- `src/components/brand/dolphin-loader.tsx` — **Swim-Bob + aufsteigende Bubbles**, respektiert reduced-motion. (= Animationsmuster „Waiting")
- `src/components/brand/success-celebration.tsx` — **Konfetti-Burst + Spring-Pop**. (= Animationsmuster „Celebrating")

### Befund
Nur **3 Emotionen** (happy / neutral / sad) + 1 Sonderpose (Bauhelm). Für ein
echtes Guide-System zu wenig: derselbe „happy"-Delfin spielt Welcome, Stolz und
Feiern; „sad" deckt Schmerz **und** Fehler ab; es fehlen alle aktiven Zustände
(zuhören, denken, sortieren, erklären, übergeben, helfen, warten).

---

## 3. Das State-System (zweistufig)

Echte Maskottchen-Systeme sind **endlich** und **modular**. Wir bauen wie Octocat:
ein konsistenter Körper, getauschte Ausdrücke + Requisiten. Zwei Ebenen:

**A. Core-Ausdrücke** — die emotionale Basis (Gesicht/Körperhaltung). Klein
gehalten, damit produzierbar & konsistent.

**B. Kontext-Posen** — Core-Ausdruck **plus Requisite/Geste** (Bauhelm, Lupe,
Klemmbrett, Paket, Megafon, …). So entsteht Vielfalt ohne Stil-Drift.

### Vollständige State-Tabelle

> `key` = Code-Identifier (Datei `/mascot/dolphin-<key>.png`). Bestehende Assets
> sind markiert; alles andere ist **neu zu generieren**.

| # | State (key) | Label | Ebene | Pose / Requisite | Asset-Status |
|---|---|---|---|---|---|
| 1 | `idle` | Neutral | Core | ruhig, leichtes Lächeln, frontal | ✅ `dolphin.png` |
| 2 | `welcoming` | Begrüßend | Core | winkt, einladend, Blick zum Nutzer | ✅ `dolphin-happy.png` (vorerst) |
| 3 | `curious` | Neugierig | Core | Kopf geneigt, große Augen, lehnt nach vorn | 🆕 |
| 4 | `listening` | Zuhörend | Core | aufmerksam, nickt leicht, Flosse am „Ohr" | 🆕 |
| 5 | `thinking` | Nachdenklich | Core | Flosse am Kinn, Gedanken-Punkte | 🆕 |
| 6 | `researching` | Recherchierend | B | Lupe, sucht/prüft | 🆕 |
| 7 | `building` | Bauend | B | Bauhelm + Werkzeug | ✅ `dolphin-think.png` (umbenennen) |
| 8 | `organizing` | Sortierend | B | stapelt Karten/Dokumente | 🆕 |
| 9 | `explaining` | Erklärend | B | zeigt auf Board / hält Doc, präsentiert | 🆕 |
| 10 | `delivering` | Übergebend | B | reicht ein Paket/Box nach vorn | 🆕 |
| 11 | `celebrating` | Feiernd | Core | Flossen hoch, Konfetti | ✅ via `success-celebration` (Pose schärfen) |
| 12 | `helping` | Helfend | Core | lugt um die Ecke, bietet Hand/Tipp | 🆕 |
| 13 | `waiting` | Wartend | Core | schwimmt/bobbt, Bubbles | ✅ via `dolphin-loader` |
| 14 | `sad` | Mitfühlend/Fehler | Core | betreten, gesenkt | ✅ `dolphin-sad.png` |

**14 States, davon 5 vorhanden, 1 nur umzubenennen, 8 neu.** Das ist die
produzierbare Mindestmenge für ein vollwertiges Guide-System.

---

## 4. State-Detailblätter

Für jeden State: **Wo · Welche Emotion · Welches Business-Ziel · Animation**.

### 1) `welcoming` — Begrüßend
- **Wo:** Hero, ganz oben (heute schon: schwebender Delfin).
- **Emotion:** „Ich bin willkommen, das ist freundlich, kein kaltes Tool."
- **Business-Ziel:** Erste-5-Sekunden-Sympathie → senkt die Absprungrate, macht die Marke menschlich.
- **Animation:** sanftes Idle-**Float** (y ±8px, 4s) — *existiert in `hero.tsx`*. Beim ersten Laden: Wink-Geste (Flosse) einmalig.

### 2) `curious` — Neugierig
- **Wo:** Hero-Demo, wenn das Idee-Eingabefeld im Fokus / „getippt" wird; im App-Chat beim Input-Fokus.
- **Emotion:** „Erzähl mir deine Idee — ich bin gespannt." Senkt die Hemmschwelle, den ersten Satz zu tippen.
- **Business-Ziel:** **Aktivierung** — mehr Besucher tippen ihre erste Idee ein (Top-of-Funnel-Conversion).
- **Animation:** **Lean-in** (scale 1→1.04, leichte Neigung zum Input) + Blinzeln. Reduced-motion: statisch.

### 3) `listening` — Zuhörend
- **Wo:** How-It-Works **Schritt 1** („Idee reinwerfen"); App-Chat während der Nutzer tippt.
- **Emotion:** „Ich werde gehört, nicht in ein Formular gepresst."
- **Business-Ziel:** **Vertrauen**, die eigene (oft unfertige) Idee zu teilen → weniger Abbruch im Onboarding.
- **Animation:** ruhiges **Nicken** (rotate ±3°, 1.5s), gelegentliches Blinzeln.

### 4) `thinking` — Nachdenklich
- **Wo:** How-It-Works **Schritt 2** („gemeinsam schärfen"); Lade-/Generier-Phasen („Finn denkt nach…").
- **Emotion:** „Da passiert echte Arbeit, ich bin in guten Händen."
- **Business-Ziel:** **Wahrgenommene Intelligenz & Qualität**; rechtfertigt Wartezeit (gefühlte Latenz sinkt).
- **Animation:** aufsteigende **Gedanken-Punkte** (•••), leichte Kopfneigung. Variante des Loader-Musters.

### 5) `researching` — Recherchierend
- **Wo:** optionale Generier-Phase „prüft Tools/Stack…"; Integrationen-Abschnitt.
- **Emotion:** „Es wird gründlich gearbeitet, nicht nur drauflosgeraten."
- **Business-Ziel:** **Qualitäts-Signal** — differenziert von „einfach ChatGPT fragen".
- **Animation:** **Lupe** fährt suchend über eine Fläche; kurzes „!"-Aufleuchten bei Fund.

### 6) `building` — Bauend  *(= heutiges `dolphin-think.png`)*
- **Wo:** How-It-Works (Section-Guide); Hero-Demo-Status „baut…".
- **Emotion:** „Mein Projekt entsteht gerade."
- **Business-Ziel:** **Fortschritt sichtbar machen** → hält Aufmerksamkeit, transportiert den Kern-Nutzen (Bauplan entsteht).
- **Animation:** leichtes **Hammer-Tippen** / Zahnrad-Dreh; Bauhelm wackelt minimal.
- **Migration:** Datei zu `dolphin-building.png` umbenennen, `building` als Alias auf das vorhandene Asset.

### 7) `organizing` — Sortierend
- **Wo:** „Was du bekommst"-Grid (Intro); App-Bibliothek/Workspace.
- **Emotion:** „Aus dem Chaos in meinem Kopf wird Ordnung."
- **Business-Ziel:** Verkauft das **„alles in einem Paket"**-Versprechen.
- **Animation:** Karten/Dokumente **schnappen** in einen sauberen Stapel (stagger).

### 8) `explaining` — Erklärend
- **Wo:** Example-Output (präsentiert das Ergebnis); FAQ.
- **Emotion:** „Das verstehe sogar ich — es ist nicht kryptisch."
- **Business-Ziel:** **Verständlichkeit** des Outputs → entkräftet „zu technisch"-Einwand.
- **Animation:** **Zeigen** auf den aktiven Tab/Inhalt; Inhalt „enthüllt" sich im Takt.

### 9) `delivering` — Übergebend
- **Wo:** Example-Output-Footer; Export-/Download-Moment in der App.
- **Emotion:** „Das gehört jetzt mir, ich kann sofort los."
- **Business-Ziel:** **Greifbarkeit** des Deliverables → erhöht wahrgenommenen Wert.
- **Animation:** **Paket gleitet** vom Delfin nach vorn / zum Nutzer; kurzes „fertig"-Häkchen.

### 10) `celebrating` — Feiernd  *(= `success-celebration`)*
- **Wo:** Final-CTA; jeder Erfolg (Login, Signup, Passwort, erstes Paket fertig).
- **Emotion:** „Geschafft! Momentum, Freude."
- **Business-Ziel:** **Conversion-Push** am Seitenende; positive Verstärkung in der App.
- **Animation:** **Konfetti-Burst + Spring-Pop** — *existiert in `success-celebration.tsx`*. Pose mit Flossen-hoch schärfen.

### 11) `helping` — Helfend
- **Wo:** schwebender Helfer (Navbar/Ecke) bei Scroll; Pricing (zeigt auf Empfehlung); leere Zustände.
- **Emotion:** „Es ist jemand da, falls ich hänge."
- **Business-Ziel:** **Reduziert Abbruch** an Entscheidungsstellen (z. B. Plan-Wahl).
- **Animation:** **Peek-in** vom Bildschirmrand; bei Pricing: deutet auf „Am beliebtesten".

### 12) `waiting` — Wartend  *(= `dolphin-loader`)*
- **Wo:** alle Ladezustände; App-Empty-State.
- **Emotion:** „Geduld lohnt sich, es tut sich was."
- **Business-Ziel:** **Gefühlte Ladezeit senken** → weniger Abbruch beim Warten.
- **Animation:** **Swim-Bob + Bubbles** — *existiert in `dolphin-loader.tsx`*.

### 13) `sad` — Mitfühlend / Fehler
- **Wo:** Problem-Section (mitfühlend); Error-Pages, 404, abgelaufener Link, Toast-Error.
- **Emotion (Problem):** „Finn kennt den Schmerz auch" → Resonanz.
- **Emotion (Fehler):** „Schade, aber niemand schimpft mit mir."
- **Business-Ziel:** **Empathie** (Problem) bzw. **Fehler entschärfen** (App).
- **Animation:** kleines Absacken/Seufzen (y +4px, langsam). Reduced-motion: statisch.

### 14) `idle` — Neutral / Marke
- **Wo:** Logo, Favicon, Avatar, jeder neutrale Kontext.
- **Business-Ziel:** **Wiedererkennung** — der Anker, von dem alle States abgeleitet wirken.
- **Animation:** keine (statisch im Logo).

---

## 5. Section-Mapping — die Finn-Reise über die Landingpage

Ein **einziger** Charakter begleitet den Besucher von oben nach unten und
**wechselt mit jedem Abschnitt seinen Zustand**. Das erzeugt das „ich werde
geführt"-Gefühl: derselbe Buddy, eine durchgehende Geschichte.

| Reihenfolge | Section | Finn-State | Mikro-Botschaft (optional, Sprechblase/Caption) |
|---|---|---|---|
| 0 | Navbar | `idle` (Logo) → `helping` beim Scrollen | — |
| 1 | **Hero** | `welcoming` → `curious` (bei Demo) | „Sag mir, was du bauen willst." |
| 2 | **Problem** | `sad` (mitfühlend) | „Kenn ich. Die leere Seite ist brutal." |
| 3 | **How It Works** | `listening` → `thinking` → `building` (pro Schritt) | „Erzähl. Ich frag nach. Ich bau's." |
| 4 | **Example Output** | `explaining` → `delivering` | „Das kam aus dieser einen Idee raus." |
| 5 | **Was du bekommst** | `organizing` | „Alles sortiert, an einem Ort." |
| 6 | **Integrationen** | `researching` / `helping` | „Passt zu den Tools, die du eh nutzt." |
| 7 | **Pricing** | `helping` (zeigt auf Empfehlung) | „Die meisten starten hier." |
| 8 | **FAQ** | `explaining` | „Frag ruhig — ich erklär's." |
| 9 | **Final CTA** | `celebrating` | „Los geht's — ich feier mit." |
| 10 | Footer | `idle` (winkt zum Abschied) | — |

**Storyboard in einem Satz:** Finn winkt dich herein → fühlt deinen Schmerz →
hört zu → denkt nach → baut → sortiert → erklärt → übergibt dir das Paket →
feiert mit dir.

---

## 6. Interaction-Mapping

| Auslöser | Reaktion | Wo |
|---|---|---|
| **Idle** (kein Input) | sanftes Float / Bob | Hero, alle stehenden Platzierungen |
| **Scroll in neue Section** | State-Wechsel + Fade/Slide-in (IntersectionObserver / `useInView`) | gesamte Landingpage |
| **Hover auf Finn** | Mikro-Reaktion: Blinzeln, kurzer Wink, eine Bubble | überall klickbar/hoverbar |
| **Input-Fokus** (Idee-Feld) | `curious` → `listening` | Hero-Demo, App-Chat |
| **Senden / Generierung läuft** | `thinking`/`building`/`waiting` (+ Loader) | App-Chat, Hero-Demo |
| **Antwort/Paket fertig** | `delivering` → kurzer `celebrating`-Funke | App, Example-Output |
| **Erfolg** (Login/Signup/Export) | `celebrating` Vollbild-Overlay | Auth, Export |
| **Fehler / leer / 404** | `sad` bzw. `waiting` | Error-/Empty-States |
| **Reduced Motion** | jeder State rendert **statisch** (kein Loop) | global, Pflicht |

**Premium-Idee — „Finn reist mit":** ein dezent persistenter Mini-Finn (32–40px)
unten rechts, der seinen State passend zur sichtbaren Section ändert und sanft
„mitschwimmt". Optional, abschaltbar, nie inhaltsverdeckend. Das ist der stärkste
Hebel fürs „geführt"-Gefühl — als Phase 2 nach den statischen Platzierungen.

---

## 7. Animations-Bibliothek

Aufbauend auf den bestehenden Mustern; alle als Framer-Motion-Presets, alle mit
`prefers-reduced-motion`-Fallback (statisch).

| Preset | Bewegung | Status | States |
|---|---|---|---|
| `float` | y ±8px, 4s ease-in-out, loop | ✅ in `hero.tsx` | `welcoming`, `idle` |
| `swim-bob` | y-bob + rotate ±4° + Bubbles | ✅ in `dolphin-loader` | `waiting` |
| `confetti-pop` | Spring-Pop + Konfetti-Burst | ✅ in `success-celebration` | `celebrating` |
| `lean-in` | scale 1→1.04, rotate→Input | 🆕 | `curious` |
| `nod` | rotate ±3°, 1.5s | 🆕 | `listening` |
| `think-dots` | 3 Punkte steigen/pulsen | 🆕 (Loader-Variante) | `thinking` |
| `glass-sweep` | Lupe wandert, „!"-Blitz | 🆕 | `researching` |
| `tool-tap` | Hammer/Zahnrad-Mikrobewegung | 🆕 | `building` |
| `card-stack` | Karten stapeln (stagger) | 🆕 | `organizing` |
| `point-reveal` | Zeigen + Inhalt enthüllt | 🆕 | `explaining` |
| `handoff` | Paket gleitet nach vorn + Häkchen | 🆕 | `delivering` |
| `peek-in` | von Bildschirmrand hereinlugen | 🆕 | `helping` |
| `sigh` | langsames Absacken | 🆕 | `sad` |

**Regeln:** Mikro-Interaktionen 150–300 ms (vgl. DESIGN.md). Loops dezent, nie
hektisch. Nie mehr als eine bewegte Finn-Instanz pro Viewport.

---

## 8. Storytelling-Ideen

1. **„Die Reise mit Finn"** — durchgehender Bogen (siehe §5). Roter Faden:
   Finn ist dein *Bau-Buddy von der Idee bis zum Launch* — exakt die
   `Idee → Plan → Build → Launch`-Leiste aus dem Hero.
2. **Das Ideen-Objekt wächst mit.** Ein wiederkehrendes Motiv: aus einem
   Funken (Hero) wird ein Stapel (Organizing) wird ein Paket (Delivering). Finn
   trägt/zeigt es durch die Seite — visuelle Kontinuität.
3. **Mikro-Captions in Finns Stimme.** Optionale, sehr kurze Sprechblasen pro
   Section (Spalte „Mikro-Botschaft" in §5) — geben Finn eine Stimme, ohne
   Walltext. A/B-testbar, standardmäßig sparsam.
4. **Finn-„Octodex".** Wie GitHubs Octodex: eine kleine Galerie von Finn-Posen
   als Marken-Asset (Social, Changelog, Sticker, 404). Macht ihn teilbar/merkbar.
5. **Onboarding-Begleiter.** In der App führt Finn (states `listening`/`thinking`/
   `building`) durch das erste Projekt — die Landingpage-Story setzt sich nahtlos
   im Produkt fort (Konsistenz Marketing ↔ Produkt).
6. **Empty-/Error-Empathie.** Finn ist auch da, wenn's klemmt (`sad`, `waiting`) —
   die Marke bleibt menschlich, gerade in Fehlmomenten.

---

## 9. Implementierungs-Architektur (Vertrag für die Asset-Phase)

> Noch nicht zu bauen — aber so wird verdrahtet, sobald Assets existieren. Damit
> ist der nächste Schritt reines „Asset rein, Key eintragen".

### 9.1 Zentrale State-Registry
Eine Datei (z. B. `src/components/brand/mascot-states.ts`):

```
export type MascotState =
  | "idle" | "welcoming" | "curious" | "listening" | "thinking"
  | "researching" | "building" | "organizing" | "explaining"
  | "delivering" | "celebrating" | "helping" | "waiting" | "sad";

// Registry: State -> { src, defaultAlt, motion }
// src zeigt auf /mascot/dolphin-<state>.png
// motion verweist auf ein Preset aus der Animations-Bibliothek (§7)
```

### 9.2 `Mascot` erweitern
- Neue, **bevorzugte** Prop: `state?: MascotState` → löst `src` + Default-`alt`
  über die Registry auf.
- `src` bleibt als manueller Override erhalten (Abwärtskompatibilität).
- Optionale `motion`-Prop bzw. eigene `AnimatedMascot`-Wrapper, die das Preset
  pro State anwenden (reduced-motion-sicher).

### 9.3 Migration der Bestands-Aufrufe
- `dolphin-happy.png` → `state="welcoming"` / `"celebrating"` (kontextabhängig).
- `dolphin-sad.png` → `state="sad"`.
- `dolphin-think.png` → Datei zu `dolphin-building.png`; `state="building"`.
- `dolphin.png` → `state="idle"`.
- `dolphin-loader` / `success-celebration` bleiben, beziehen Pose künftig über die Registry.

### 9.4 Asset-Produktions-Checkliste (für die Higgsfield-Phase)
- **Format:** quadratisches, **transparentes PNG** (wie heute), ein großes Master
  (~512–1024px); `next/image` skaliert pro Einsatz.
- **Konsistenz (kritisch!):** identische Körperproportion, **gleiche Augen-Höhe,
  gleiche Mitte, gleicher Maßstab & Safe-Area** über alle States — sonst
  „springt" Finn beim Wechsel. Gleicher Stil/Outline/Schattierung, gleiche
  Babyblau-Palette wie die Marke (siehe DESIGN.md `--accent`).
- **Benennung:** `/mascot/dolphin-<state>.png` exakt nach §9.1-Keys.
- **Zu generieren (8 neu):** `curious`, `listening`, `thinking`, `researching`,
  `organizing`, `explaining`, `delivering`, `helping`.
- **Zu schärfen/umbenennen (3):** `welcoming` (eigene Wink-Pose statt happy-Reuse),
  `celebrating` (Flossen-hoch), `building` (= think.png umbenennen).
- **Bereits ok (3):** `idle`, `sad`, (happy als Übergang).
- **A11y:** dekorativ → `alt=""`; nur wenn Finn allein steht, sprechendes `alt`.

---

## 10. Roadmap

1. ✅ **Diese Spec.** System, States, Mapping, Architektur.
2. ⬜ **Assets generieren** (Higgsfield) — 8 neu + 3 schärfen, nach §9.4-Regeln.
3. ⬜ **Registry + `Mascot`-Erweiterung** bauen (§9.1–9.3), Bestand migrieren.
4. ⬜ **Statische State-Platzierungen** pro Section verdrahten (§5).
5. ⬜ **Animations-Presets** ergänzen (§7), reduced-motion verifizieren.
6. ⬜ **Phase 2 (optional):** „Finn reist mit" (persistenter Mini-Guide), Mikro-Captions, Octodex.
